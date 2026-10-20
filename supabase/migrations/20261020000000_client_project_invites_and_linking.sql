-- ============================================================
-- AUVRYN Enterprise: Project Client Invites & Client Record Linking
-- Migration: 20261020000000_client_project_invites_and_linking.sql
-- ============================================================

-- 0. Ensure 'client' value exists in user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'client';

-- 1. Ensure user_id column exists on public.clients
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);

-- 2. Create public.project_invites table
CREATE TABLE IF NOT EXISTS public.project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_email VARCHAR(255),
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_approve BOOLEAN NOT NULL DEFAULT true,
  can_request_changes BOOLEAN NOT NULL DEFAULT true,
  can_view_financials BOOLEAN NOT NULL DEFAULT true,
  can_view_receipts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_invites_token ON public.project_invites(token);
CREATE INDEX IF NOT EXISTS idx_project_invites_email ON public.project_invites(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_project_invites_client ON public.project_invites(client_id);
CREATE INDEX IF NOT EXISTS idx_project_invites_project ON public.project_invites(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invites_status ON public.project_invites(status);

-- 3. Enable RLS on project_invites
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project managers can view project invites" ON public.project_invites;
CREATE POLICY "Project managers can view project invites"
  ON public.project_invites FOR SELECT
  TO authenticated
  USING (
    invited_by = auth.uid() OR
    owner_id = auth.uid() OR
    public.can_manage_project(auth.uid(), project_id) OR
    token = current_setting('request.jwt.claim.token', true)
  );

DROP POLICY IF EXISTS "Project managers can create project invites" ON public.project_invites;
CREATE POLICY "Project managers can create project invites"
  ON public.project_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid() OR
    owner_id = auth.uid() OR
    public.can_manage_project(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "Project managers can update project invites" ON public.project_invites;
CREATE POLICY "Project managers can update project invites"
  ON public.project_invites FOR UPDATE
  TO authenticated
  USING (
    invited_by = auth.uid() OR
    owner_id = auth.uid() OR
    public.can_manage_project(auth.uid(), project_id)
  );

-- 4. Update RLS on public.clients to allow client users to view their own client profile
DROP POLICY IF EXISTS "Select clients" ON public.clients;
CREATE POLICY "Select clients" ON public.clients FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      user_id = (select auth.uid())::uuid OR
      (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())::uuid) AND
       public.has_permission((select auth.uid())::uuid, 'manage_clients'))
    )
  );

-- 5. Update RLS on public.invoices to allow client users to view their invoices
DROP POLICY IF EXISTS "Select invoices" ON public.invoices;
CREATE POLICY "Select invoices" ON public.invoices FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())::uuid) AND
       public.has_permission((select auth.uid())::uuid, 'view_invoices')) OR
      (client_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = invoices.client_id AND c.user_id = (select auth.uid())::uuid) OR
        EXISTS (SELECT 1 FROM public.project_client_access pca WHERE pca.client_id = invoices.client_id AND pca.user_id = (select auth.uid())::uuid AND pca.status = 'active' AND pca.can_view_financials = true)
      ))
    )
  );

-- 6. Atomic function to accept project client invite
CREATE OR REPLACE FUNCTION public.accept_project_client_invite(
  p_token TEXT,
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite public.project_invites%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_norm_email TEXT;
  v_existing_pca public.project_client_access%ROWTYPE;
BEGIN
  v_norm_email := LOWER(TRIM(p_user_email));

  -- 1. Lock and validate invite token
  SELECT * INTO v_invite
  FROM public.project_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVITE_NOT_FOUND',
      'message', 'Invitation token is invalid or does not exist.'
    );
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVITE_REVOKED',
      'message', 'This invitation has been revoked by the workspace administrator.'
    );
  END IF;

  -- Idempotency: if already accepted by the same user, return success
  IF v_invite.status = 'accepted' THEN
    IF v_invite.accepted_by = p_user_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_accepted', true,
        'project_id', v_invite.project_id,
        'client_id', v_invite.client_id,
        'user_id', p_user_id
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVITE_ALREADY_USED',
        'message', 'This invitation has already been accepted by another user.'
      );
    END IF;
  END IF;

  -- Check expiry
  IF v_invite.expires_at < now() OR v_invite.status = 'expired' THEN
    UPDATE public.project_invites
    SET status = 'expired', updated_at = now()
    WHERE id = v_invite.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVITE_EXPIRED',
      'message', 'This invitation has expired. Please request a new invite.'
    );
  END IF;

  -- 2. Verify target client record exists
  SELECT * INTO v_client
  FROM public.clients
  WHERE id = v_invite.client_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CLIENT_NOT_FOUND',
      'message', 'The client record associated with this invitation no longer exists.'
    );
  END IF;


  -- 3. Link user to the EXISTING client record (never duplicate client)
  UPDATE public.clients
  SET user_id = p_user_id,
      updated_at = now()
  WHERE id = v_invite.client_id;

  -- 4. Grant access in project_client_access
  INSERT INTO public.project_client_access (
    project_id,
    client_id,
    user_id,
    access_role,
    can_view,
    can_approve,
    can_request_changes,
    can_view_financials,
    can_view_receipts,
    status,
    invited_by,
    invited_at,
    accepted_at,
    updated_at
  ) VALUES (
    v_invite.project_id,
    v_invite.client_id,
    p_user_id,
    'viewer',
    v_invite.can_view,
    v_invite.can_approve,
    v_invite.can_request_changes,
    v_invite.can_view_financials,
    v_invite.can_view_receipts,
    'active',
    v_invite.invited_by,
    v_invite.created_at,
    now(),
    now()
  )
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    can_view = EXCLUDED.can_view,
    can_approve = EXCLUDED.can_approve,
    can_request_changes = EXCLUDED.can_request_changes,
    can_view_financials = EXCLUDED.can_view_financials,
    can_view_receipts = EXCLUDED.can_view_receipts,
    status = 'active',
    accepted_at = now(),
    updated_at = now();

  -- 5. Mark user profile as setup completed with role client if unassigned
  UPDATE public.users
  SET 
    account_type = 'client',
    account_setup_completed = true,
    role = CASE 
      WHEN role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'senior_employee', 'employee', 'freelancer') THEN role 
      ELSE 'client' 
    END,
    updated_at = now()
  WHERE id = p_user_id;

  -- 6. Mark invite accepted with timestamp and recording both emails
  UPDATE public.project_invites
  SET 
    status = 'accepted',
    accepted_at = now(),
    accepted_by = p_user_id,
    accepted_email = v_norm_email,
    updated_at = now()
  WHERE id = v_invite.id;

  -- 7. Register activity event in activity_logs (defensive so optional logging never blocks acceptance)
  BEGIN
    INSERT INTO public.activity_logs (
      org_id,
      actor_id,
      action,
      entity_type,
      entity_id,
      new_value
    ) VALUES (
      v_invite.business_id,
      p_user_id,
      'CLIENT_INVITE_ACCEPTED',
      'project',
      v_invite.project_id,
      jsonb_build_object(
        'client_id', v_invite.client_id,
        'invited_email', v_invite.email,
        'accepted_email', v_norm_email,
        'user_id', p_user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;


  RETURN jsonb_build_object(
    'success', true,
    'project_id', v_invite.project_id,
    'client_id', v_invite.client_id,
    'user_id', p_user_id,
    'client_name', v_client.name,
    'invited_email', v_invite.email,
    'accepted_email', v_norm_email
  );
END;
$$;
