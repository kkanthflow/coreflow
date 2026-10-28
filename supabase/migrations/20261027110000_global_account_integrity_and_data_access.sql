-- ==============================================================================
-- AUVRYN: GLOBAL SUPABASE INTEGRATION AND ACCOUNT DATA INTEGRITY MIGRATION
-- 1. Sync organizations.owner_id for all organizations
-- 2. Populate missing roles in public.roles
-- 3. Upgrade public.has_permission to verify org roles & org ownership
-- 4. Auto-heal public.users account_type and account_setup_completed
-- 5. Repair RLS policies on invoices, clients, organizations, and user_organizations
-- 6. Ensure handle_new_user trigger reliability
-- ==============================================================================

-- 1. SYNC ORGANIZATIONS.OWNER_ID
-- Ensure any organization whose owner_id is NULL gets updated from user_organizations where role = 'owner'
UPDATE public.organizations o
SET owner_id = uo.user_id
FROM public.user_organizations uo
WHERE o.id = uo.org_id
  AND uo.role = 'owner'
  AND o.owner_id IS NULL;

-- 2. POPULATE ALL SYSTEM ROLES IN public.roles
-- Ensure all roles defined in PBAC have explicit entries and permissions
INSERT INTO public.roles (role_name, permissions)
VALUES 
  ('owner', '["manage_organization","manage_departments","manage_roles","invite_users","remove_users","create_projects","assign_projects","manage_projects","view_projects","view_all_projects","manage_all_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","manage_chat","create_invoices","approve_invoices","view_reports","export_reports","view_audit_logs","schedule_meetings","view_team_directory","view_invoices","edit_invoices","delete_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs","manage_test_accounts"]'::jsonb),
  ('administrator', '["manage_organization","manage_departments","manage_roles","invite_users","remove_users","create_projects","assign_projects","manage_projects","view_projects","view_all_projects","manage_all_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","manage_chat","create_invoices","approve_invoices","view_reports","export_reports","view_audit_logs","schedule_meetings","view_team_directory","view_invoices","edit_invoices","delete_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs"]'::jsonb),
  ('managing_director', '["manage_organization","manage_departments","manage_roles","invite_users","remove_users","create_projects","assign_projects","manage_projects","view_projects","view_all_projects","manage_all_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","manage_chat","create_invoices","approve_invoices","view_reports","export_reports","view_audit_logs","schedule_meetings","view_team_directory","view_invoices","edit_invoices","delete_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs","manage_test_accounts"]'::jsonb),
  ('ceo', '["manage_organization","manage_departments","manage_roles","invite_users","remove_users","create_projects","assign_projects","manage_projects","view_projects","view_all_projects","manage_all_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","manage_chat","create_invoices","approve_invoices","view_reports","export_reports","view_audit_logs","schedule_meetings","view_team_directory","view_invoices","edit_invoices","delete_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs","manage_test_accounts"]'::jsonb),
  ('cto', '["manage_organization","manage_departments","manage_roles","invite_users","remove_users","create_projects","assign_projects","manage_projects","view_projects","view_all_projects","manage_all_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","manage_chat","create_invoices","approve_invoices","view_reports","export_reports","view_audit_logs","schedule_meetings","view_team_directory","view_invoices","edit_invoices","delete_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs","manage_test_accounts"]'::jsonb),
  ('admin', '["manage_organization","manage_departments","manage_roles","invite_users","remove_users","create_projects","assign_projects","manage_projects","view_projects","view_all_projects","manage_all_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","manage_chat","create_invoices","approve_invoices","view_reports","export_reports","view_audit_logs","schedule_meetings","view_team_directory","view_invoices","edit_invoices","delete_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs"]'::jsonb),
  ('director', '["manage_departments","invite_users","remove_users","create_projects","assign_projects","manage_projects","view_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","create_invoices","approve_invoices","view_reports","export_reports","schedule_meetings","view_team_directory","view_invoices","edit_invoices","delete_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs"]'::jsonb),
  ('senior_manager', '["invite_users","create_projects","assign_projects","manage_projects","view_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","create_invoices","view_reports","schedule_meetings","view_team_directory","view_invoices","edit_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs"]'::jsonb),
  ('manager', '["invite_users","create_projects","assign_projects","manage_projects","view_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","create_invoices","view_reports","schedule_meetings","view_team_directory","view_invoices","edit_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs"]'::jsonb),
  ('project_manager', '["invite_users","create_projects","assign_projects","manage_projects","view_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","create_invoices","view_reports","schedule_meetings","view_team_directory","view_invoices","edit_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs"]'::jsonb),
  ('hr', '["manage_organization","manage_departments","manage_roles","invite_users","remove_users","view_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","schedule_meetings","view_team_directory"]'::jsonb),
  ('team_lead', '["manage_projects","view_projects","create_tasks","assign_tasks","manage_tasks","upload_files","download_files","send_messages","schedule_meetings","view_team_directory"]'::jsonb),
  ('senior_employee', '["view_projects","create_tasks","manage_tasks","upload_files","download_files","send_messages","schedule_meetings","view_team_directory"]'::jsonb),
  ('employee', '["view_projects","create_tasks","manage_tasks","upload_files","download_files","send_messages","schedule_meetings","view_team_directory"]'::jsonb),
  ('developer', '["view_projects","create_tasks","manage_tasks","upload_files","download_files","send_messages","schedule_meetings","view_team_directory"]'::jsonb),
  ('general_member', '["view_projects","create_tasks","manage_tasks","upload_files","download_files","send_messages","schedule_meetings","view_team_directory"]'::jsonb),
  ('intern', '["view_projects","manage_tasks","upload_files","download_files","send_messages","schedule_meetings","view_team_directory"]'::jsonb),
  ('freelancer', '["view_projects","manage_tasks","upload_files","download_files","schedule_meetings","view_invoices","create_invoices","edit_invoices","record_payments","manage_clients","manage_bill_references","generate_invoice_pdfs"]'::jsonb),
  ('client', '["view_projects","view_invoices","download_files","send_messages"]'::jsonb)
ON CONFLICT (role_name) DO UPDATE 
SET permissions = EXCLUDED.permissions;

-- 3. UPGRADE public.has_permission FUNCTION
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR(50);
  v_has BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  -- A. Check if user is an owner of ANY organization in public.organizations
  IF EXISTS (SELECT 1 FROM public.organizations WHERE owner_id = p_user_id) THEN
    SELECT (permissions ? p_permission) INTO v_has
    FROM public.roles
    WHERE role_name = 'owner';
    IF COALESCE(v_has, FALSE) = TRUE THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- B. Check direct role in users table
  SELECT role::VARCHAR INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS NOT NULL THEN
    SELECT (permissions ? p_permission) INTO v_has
    FROM public.roles
    WHERE role_name = v_role;
    IF COALESCE(v_has, FALSE) = TRUE THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- C. Check any organization role in user_organizations
  FOR v_role IN 
    SELECT role FROM public.user_organizations WHERE user_id = p_user_id
  LOOP
    SELECT (permissions ? p_permission) INTO v_has
    FROM public.roles
    WHERE role_name = v_role;
    IF COALESCE(v_has, FALSE) = TRUE THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

-- Helper function: has_permission for a specific organization
CREATE OR REPLACE FUNCTION public.has_org_permission(p_user_id uuid, p_org_id uuid, p_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR(50);
  v_has BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. If user is owner of this organization
  IF p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Check user's role in this specific organization
  IF p_org_id IS NOT NULL THEN
    SELECT role INTO v_role FROM public.user_organizations 
    WHERE org_id = p_org_id AND user_id = p_user_id;
    IF v_role IS NOT NULL THEN
      SELECT (permissions ? p_permission) INTO v_has
      FROM public.roles
      WHERE role_name = v_role;
      IF COALESCE(v_has, FALSE) = TRUE THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;

  -- 3. Fallback to global has_permission
  RETURN public.has_permission(p_user_id, p_permission);
END;
$$;

-- 4. AUTO-HEAL public.users ACCOUNT STATUS
-- Heal organization members
UPDATE public.users u
SET account_type = 'organization',
    default_workspace_id = COALESCE(u.default_workspace_id, uo.org_id::text),
    account_setup_completed = true
FROM public.user_organizations uo
WHERE u.id = uo.user_id
  AND (u.account_type IS NULL OR u.account_setup_completed = false OR u.account_setup_completed IS NULL);

-- Heal organization owners
UPDATE public.users u
SET account_type = 'organization',
    role = 'owner',
    default_workspace_id = COALESCE(u.default_workspace_id, o.id::text),
    account_setup_completed = true
FROM public.organizations o
WHERE u.id = o.owner_id
  AND (u.account_type IS NULL OR u.account_setup_completed = false OR u.account_setup_completed IS NULL);

-- Heal freelancers
UPDATE public.users u
SET account_type = 'freelancer',
    role = 'freelancer',
    default_workspace_id = 'independent',
    account_setup_completed = true
WHERE (u.role = 'freelancer' OR EXISTS (SELECT 1 FROM public.freelancer_profiles fp WHERE fp.id = u.id))
  AND (u.account_type IS NULL OR u.account_setup_completed = false OR u.account_setup_completed IS NULL);

-- Heal client accounts
UPDATE public.users u
SET account_type = 'client',
    role = 'client',
    account_setup_completed = true
WHERE (u.role = 'client' OR EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = u.id))
  AND (u.account_type IS NULL OR u.account_setup_completed = false OR u.account_setup_completed IS NULL);

-- 5. REPAIR RLS POLICIES ON INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select invoices" ON public.invoices;
CREATE POLICY "Select invoices"
ON public.invoices FOR SELECT TO authenticated
USING (
  is_deleted = false
  AND (
    -- 1. Owner or creator of the invoice always has view access
    owner_id = auth.uid()
    OR (creator_id IS NOT NULL AND creator_id = auth.uid())

    -- 2. Organization members with view_invoices permission or org owners
    OR (
      organization_id IS NOT NULL 
      AND (
        EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = invoices.organization_id AND o.owner_id = auth.uid()
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = invoices.organization_id AND uo.user_id = auth.uid()
          )
          AND public.has_permission(auth.uid(), 'view_invoices')
        )
      )
    )

    -- 3. Clients viewing their own invoices (excluding drafts and cancelled)
    OR (
      client_id IS NOT NULL 
      AND (status)::text <> ALL (ARRAY['draft'::text, 'cancelled'::text])
      AND (
        EXISTS (
          SELECT 1 FROM public.clients c
          WHERE c.id = invoices.client_id 
            AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(auth.jwt()->>'email'))
        )
        OR EXISTS (
          SELECT 1 FROM public.project_client_access pca
          WHERE pca.client_id = invoices.client_id 
            AND pca.user_id = auth.uid() 
            AND pca.status = 'active' 
            AND pca.can_view_financials = true
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "Insert invoices" ON public.invoices;
CREATE POLICY "Insert invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  -- Owner is authenticated caller
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = invoices.organization_id AND o.owner_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = invoices.organization_id AND uo.user_id = auth.uid())
        AND public.has_permission(auth.uid(), 'create_invoices')
      )
    )
  )
);

DROP POLICY IF EXISTS "Update invoices" ON public.invoices;
CREATE POLICY "Update invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = invoices.organization_id AND o.owner_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = invoices.organization_id AND uo.user_id = auth.uid())
        AND public.has_permission(auth.uid(), 'edit_invoices')
      )
    )
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = invoices.organization_id AND o.owner_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = invoices.organization_id AND uo.user_id = auth.uid())
        AND public.has_permission(auth.uid(), 'edit_invoices')
      )
    )
  )
);

DROP POLICY IF EXISTS "Delete invoices" ON public.invoices;
CREATE POLICY "Delete invoices"
ON public.invoices FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = invoices.organization_id AND o.owner_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = invoices.organization_id AND uo.user_id = auth.uid())
        AND public.has_permission(auth.uid(), 'delete_invoices')
      )
    )
  )
);

-- 6. REPAIR RLS POLICIES ON CLIENTS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select clients" ON public.clients;
CREATE POLICY "Select clients"
ON public.clients FOR SELECT TO authenticated
USING (
  is_deleted = false
  AND (
    -- 1. Owner or creator of the client record always has access
    owner_id = auth.uid()

    -- 2. Client contact viewing their own profile
    OR user_id = auth.uid()
    OR (email IS NOT NULL AND LOWER(email) = LOWER(auth.jwt()->>'email'))

    -- 3. Organization members with manage_clients or org owners
    OR (
      organization_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.organizations o
          WHERE o.id = clients.organization_id AND o.owner_id = auth.uid()
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.user_organizations uo
            WHERE uo.org_id = clients.organization_id AND uo.user_id = auth.uid()
          )
          AND public.has_permission(auth.uid(), 'manage_clients')
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "Insert clients" ON public.clients;
CREATE POLICY "Insert clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = clients.organization_id AND o.owner_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = clients.organization_id AND uo.user_id = auth.uid())
        AND public.has_permission(auth.uid(), 'manage_clients')
      )
    )
  )
);

DROP POLICY IF EXISTS "Update clients" ON public.clients;
CREATE POLICY "Update clients"
ON public.clients FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = clients.organization_id AND o.owner_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = clients.organization_id AND uo.user_id = auth.uid())
        AND public.has_permission(auth.uid(), 'manage_clients')
      )
    )
  )
)
WITH CHECK (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = clients.organization_id AND o.owner_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = clients.organization_id AND uo.user_id = auth.uid())
        AND public.has_permission(auth.uid(), 'manage_clients')
      )
    )
  )
);

DROP POLICY IF EXISTS "Delete clients" ON public.clients;
CREATE POLICY "Delete clients"
ON public.clients FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = clients.organization_id AND o.owner_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = clients.organization_id AND uo.user_id = auth.uid())
        AND public.has_permission(auth.uid(), 'manage_clients')
      )
    )
  )
);

-- 7. UPDATE handle_new_user TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_role_str text;
  v_full_name text;
BEGIN
  v_role_str := new.raw_user_meta_data->>'role';
  v_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  
  BEGIN
    IF v_role_str IS NOT NULL AND v_role_str != '' THEN
      v_role := v_role_str::public.user_role;
    ELSE
      v_role := 'general_member'::public.user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'general_member'::public.user_role;
  END;

  INSERT INTO public.users (
    id, 
    email, 
    full_name, 
    role, 
    default_workspace_id, 
    account_type, 
    account_setup_completed,
    current_plan_tier,
    subscription_status
  )
  VALUES (
    new.id, 
    new.email, 
    v_full_name,
    v_role,
    NULL,
    NULL,
    false,
    'free',
    'free'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name);
  
  BEGIN
    INSERT INTO public.user_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN new;
END;
$$;
