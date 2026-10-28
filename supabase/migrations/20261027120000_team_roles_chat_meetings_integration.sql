-- ==============================================================================
-- AUVRYN — Global Team Membership, Role Editing, Chat, Meetings & Module Integration Fix
-- Migration: 20261027120000_team_roles_chat_meetings_integration.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SYNCHRONIZE WORKSPACES WITH ORGANIZATIONS & BACKFILL OWNERS
-- ------------------------------------------------------------------------------

-- Ensure every organization has a linked record in public.workspaces
INSERT INTO public.workspaces (
  id, name, type, status, owner_id, organization_id, created_at
)
SELECT 
  gen_random_uuid(),
  o.name,
  'organization',
  'active',
  o.owner_id,
  o.id,
  now()
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspaces w WHERE w.organization_id = o.id
)
ON CONFLICT DO NOTHING;

-- Link any existing unlinked workspaces by organization name/owner
UPDATE public.workspaces w
SET organization_id = o.id
FROM public.organizations o
WHERE w.organization_id IS NULL 
  AND (w.name ILIKE o.name OR (w.owner_id = o.owner_id AND o.owner_id IS NOT NULL));

-- Drop restrictive single-user unique constraint if present (keep UNIQUE (user_id, org_id))
ALTER TABLE public.user_organizations DROP CONSTRAINT IF EXISTS user_organizations_user_id_key;

-- Ensure all organization owners are members of public.user_organizations
INSERT INTO public.user_organizations (
  user_id, org_id, role, joined_at
)
SELECT 
  o.owner_id,
  o.id,
  'owner',
  now()
FROM public.organizations o
WHERE o.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = o.id AND uo.user_id = o.owner_id
  )
ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'owner';

-- ------------------------------------------------------------------------------
-- 2. SECURE ATOMIC ROLE EDITING RPC: update_organization_member_role
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_organization_member_role(
  p_org_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role varchar;
  v_is_org_owner boolean;
  v_target_old_role varchar;
  v_target_email text;
  v_target_full_name text;
  v_org_name text;
  v_clean_role varchar;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- 1. Verify organization exists
  SELECT name INTO v_org_name
  FROM public.organizations
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found.' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Check if caller is the organization owner
  SELECT (owner_id = v_caller_id) INTO v_is_org_owner
  FROM public.organizations
  WHERE id = p_org_id;

  -- 3. Check caller's role in this organization
  SELECT role INTO v_caller_role
  FROM public.user_organizations
  WHERE org_id = p_org_id AND user_id = v_caller_id;

  -- 4. Authorize caller
  IF NOT (
    COALESCE(v_is_org_owner, false) = true
    OR v_caller_role = ANY(ARRAY['owner', 'administrator', 'managing_director', 'ceo', 'director', 'senior_manager', 'manager', 'hr']::varchar[])
    OR public.has_org_permission(v_caller_id, p_org_id, 'manage_roles')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to manage member roles in this organization.' USING ERRCODE = '42501';
  END IF;

  -- 5. Anti-self-elevation: Users cannot edit their own role
  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Security violation: Users cannot modify their own role.' USING ERRCODE = '42501';
  END IF;

  -- 6. Verify target membership in organization
  SELECT role INTO v_target_old_role
  FROM public.user_organizations
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected user is not a member of this organization.' USING ERRCODE = 'P0002';
  END IF;

  -- 7. Owner protection: The primary organization owner cannot be modified or demoted
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Security violation: The primary organization owner cannot be modified or demoted.' USING ERRCODE = '42501';
  END IF;

  -- 8. Clean and validate new role
  v_clean_role := LOWER(TRIM(p_new_role));
  
  -- Handle legacy mapping
  IF v_clean_role = 'member' THEN
    v_clean_role := 'employee';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.roles WHERE role_name = v_clean_role) THEN
    RAISE EXCEPTION 'Invalid role name: %. Role does not exist in system roles.', v_clean_role USING ERRCODE = '22023';
  END IF;

  -- 9. Privilege hierarchy enforcement
  -- Only the organization owner or executive CEO/Managing Director can assign owner or administrator roles
  IF v_clean_role IN ('owner', 'administrator') AND NOT (
    COALESCE(v_is_org_owner, false) = true 
    OR v_caller_role IN ('owner', 'ceo', 'managing_director')
  ) THEN
    RAISE EXCEPTION 'Permission denied. Only organization owners and executive leadership can grant administrator roles.' USING ERRCODE = '42501';
  END IF;

  -- Ordinary managers cannot promote above their own role rank
  IF v_caller_role IN ('manager', 'senior_manager') AND v_clean_role IN ('director', 'administrator', 'owner', 'managing_director', 'ceo') THEN
    RAISE EXCEPTION 'Permission denied. You cannot assign a role higher than your own management tier.' USING ERRCODE = '42501';
  END IF;

  -- 10. Update public.user_organizations
  UPDATE public.user_organizations
  SET role = v_clean_role
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- 11. Synchronize public.users profile
  UPDATE public.users
  SET role = v_clean_role::public.user_role,
      account_setup_completed = true,
      default_workspace_id = p_org_id::text
  WHERE id = p_target_user_id;

  -- 12. Record activity / audit log
  SELECT email, full_name INTO v_target_email, v_target_full_name
  FROM public.users WHERE id = p_target_user_id;

  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value, new_value
  ) VALUES (
    p_org_id,
    v_caller_id,
    'member_role_updated',
    'user_organizations',
    p_target_user_id,
    jsonb_build_object('role', v_target_old_role),
    jsonb_build_object('role', v_clean_role, 'target_email', v_target_email, 'target_name', v_target_full_name)
  );

  SELECT jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'user_id', p_target_user_id,
    'old_role', v_target_old_role,
    'new_role', v_clean_role,
    'message', format('Successfully updated %s to %s.', COALESCE(v_target_full_name, v_target_email, 'member'), REPLACE(v_clean_role, '_', ' '))
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_organization_member_role(uuid, uuid, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. REPAIR USER & USER_ORGANIZATIONS RLS POLICIES
-- ------------------------------------------------------------------------------

-- Allow organization owners and authorized leadership to update user profiles
DROP POLICY IF EXISTS "Update users" ON public.users;
CREATE POLICY "Update users" ON public.users
FOR UPDATE TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['owner'::user_role, 'administrator'::user_role, 'managing_director'::user_role, 'ceo'::user_role, 'cto'::user_role])
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.user_organizations uo ON uo.org_id = o.id
    WHERE o.owner_id = auth.uid() AND uo.user_id = users.id
  )
)
WITH CHECK (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = ANY(ARRAY['owner'::user_role, 'administrator'::user_role, 'managing_director'::user_role, 'ceo'::user_role, 'cto'::user_role])
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.user_organizations uo ON uo.org_id = o.id
    WHERE o.owner_id = auth.uid() AND uo.user_id = users.id
  )
);

-- Update user_organizations UPDATE policy
DROP POLICY IF EXISTS "Org admins can update user memberships" ON public.user_organizations;
CREATE POLICY "Org admins can update user memberships" ON public.user_organizations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = user_organizations.org_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid() 
      AND uo.org_id = user_organizations.org_id 
      AND (
        (uo.role)::text = ANY (ARRAY['owner', 'administrator', 'managing_director', 'ceo', 'director', 'senior_manager', 'manager', 'hr'])
        OR public.has_org_permission(auth.uid(), user_organizations.org_id, 'manage_roles')
      )
  )
);

-- Allow admins to delete/remove members
DROP POLICY IF EXISTS "Admins can remove org members" ON public.user_organizations;
CREATE POLICY "Admins can remove org members" ON public.user_organizations
FOR DELETE TO authenticated
USING (
  -- Prevent removing the organization owner
  NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = user_organizations.org_id AND o.owner_id = user_organizations.user_id
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = user_organizations.org_id AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid() 
        AND uo.org_id = user_organizations.org_id 
        AND (uo.role)::text = ANY (ARRAY['owner', 'administrator', 'managing_director', 'ceo', 'director', 'hr'])
    )
  )
);

-- ------------------------------------------------------------------------------
-- 4. CHAT RLS POLICIES & ATOMIC DIRECT MESSAGING HELPER
-- ------------------------------------------------------------------------------

-- A. chat_channels: allow creating DMs and org channels
DROP POLICY IF EXISTS "Authorized members can create channels" ON public.chat_channels;
CREATE POLICY "Authorized members can create channels" ON public.chat_channels
FOR INSERT TO authenticated
WITH CHECK (
  -- 1. Direct message channels
  (type = 'direct' AND created_by = auth.uid())
  -- 2. Organization channels
  OR (
    org_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.org_id = chat_channels.org_id AND uo.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = chat_channels.org_id AND o.owner_id = auth.uid()
      )
    )
  )
);

-- B. channel_members: add INSERT policy
DROP POLICY IF EXISTS "Users can insert channel members" ON public.channel_members;
CREATE POLICY "Users can insert channel members" ON public.channel_members
FOR INSERT TO authenticated
WITH CHECK (
  -- Creator of the channel can add members
  EXISTS (
    SELECT 1 FROM public.chat_channels cc
    WHERE cc.id = channel_members.channel_id AND cc.created_by = auth.uid()
  )
  -- Or existing channel member can invite others
  OR EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = channel_members.channel_id AND cm.user_id = auth.uid()
  )
  -- Or org admin can add members
  OR EXISTS (
    SELECT 1 FROM public.chat_channels cc
    JOIN public.user_organizations uo ON uo.org_id = cc.org_id
    WHERE cc.id = channel_members.channel_id 
      AND uo.user_id = auth.uid() 
      AND (uo.role)::text = ANY(ARRAY['owner', 'administrator', 'director', 'manager'])
  )
);

-- C. channel_members: add DELETE policy
DROP POLICY IF EXISTS "Users can leave or remove channel members" ON public.channel_members;
CREATE POLICY "Users can leave or remove channel members" ON public.channel_members
FOR DELETE TO authenticated
USING (
  -- Member leaving own channel
  user_id = auth.uid()
  -- Or channel creator
  OR EXISTS (
    SELECT 1 FROM public.chat_channels cc
    WHERE cc.id = channel_members.channel_id AND cc.created_by = auth.uid()
  )
  -- Or org admin
  OR EXISTS (
    SELECT 1 FROM public.chat_channels cc
    JOIN public.user_organizations uo ON uo.org_id = cc.org_id
    WHERE cc.id = channel_members.channel_id 
      AND uo.user_id = auth.uid() 
      AND (uo.role)::text = ANY(ARRAY['owner', 'administrator', 'director'])
  )
);

-- D. user_public_keys: add INSERT / UPDATE policies
DROP POLICY IF EXISTS "Users can insert own public key" ON public.user_public_keys;
CREATE POLICY "Users can insert own public key" ON public.user_public_keys
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own public key" ON public.user_public_keys;
CREATE POLICY "Users can update own public key" ON public.user_public_keys
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- E. Atomic DM creation RPC: get_or_create_direct_channel
CREATE OR REPLACE FUNCTION public.get_or_create_direct_channel(
  p_target_user_id uuid,
  p_org_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_existing_channel_id uuid;
  v_new_channel_id uuid;
  v_resolved_org_id uuid;
  v_caller_email text;
  v_target_email text;
  v_target_name text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot start a direct conversation with yourself.' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_caller_email FROM public.users WHERE id = v_caller_id;
  SELECT email, full_name INTO v_target_email, v_target_name FROM public.users WHERE id = p_target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Resolve organization context
  v_resolved_org_id := p_org_id;
  IF v_resolved_org_id IS NULL THEN
    SELECT uo1.org_id INTO v_resolved_org_id
    FROM public.user_organizations uo1
    JOIN public.user_organizations uo2 ON uo1.org_id = uo2.org_id
    WHERE uo1.user_id = v_caller_id AND uo2.user_id = p_target_user_id
    LIMIT 1;
  END IF;

  -- Check if a direct channel between these two users already exists
  SELECT cc.id INTO v_existing_channel_id
  FROM public.chat_channels cc
  WHERE cc.type = 'direct'
    AND EXISTS (
      SELECT 1 FROM public.channel_members cm1 WHERE cm1.channel_id = cc.id AND cm1.user_id = v_caller_id
    )
    AND EXISTS (
      SELECT 1 FROM public.channel_members cm2 WHERE cm2.channel_id = cc.id AND cm2.user_id = p_target_user_id
    )
  LIMIT 1;

  IF v_existing_channel_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'success', true,
      'channel_id', v_existing_channel_id,
      'is_new', false,
      'target_name', v_target_name,
      'target_email', v_target_email
    ) INTO v_res;
    RETURN v_res;
  END IF;

  -- Create new direct channel
  INSERT INTO public.chat_channels (
    org_id,
    type,
    name,
    created_by,
    created_at
  ) VALUES (
    v_resolved_org_id,
    'direct',
    COALESCE(v_caller_email, 'user') || '_' || COALESCE(v_target_email, 'user'),
    v_caller_id,
    now()
  )
  RETURNING id INTO v_new_channel_id;

  -- Insert both members into channel_members
  INSERT INTO public.channel_members (channel_id, user_id, joined_at)
  VALUES 
    (v_new_channel_id, v_caller_id, now()),
    (v_new_channel_id, p_target_user_id, now())
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  SELECT jsonb_build_object(
    'success', true,
    'channel_id', v_new_channel_id,
    'is_new', true,
    'target_name', v_target_name,
    'target_email', v_target_email
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_channel(uuid, uuid) TO authenticated;

-- Ensure default org channels exist for all organizations
INSERT INTO public.chat_channels (id, org_id, name, type, created_at)
SELECT gen_random_uuid(), o.id, 'general', 'org_general', now()
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_channels cc WHERE cc.org_id = o.id AND cc.type = 'org_general'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.chat_channels (id, org_id, name, type, created_at)
SELECT gen_random_uuid(), o.id, 'announcements', 'org_announcement', now()
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_channels cc WHERE cc.org_id = o.id AND cc.type = 'org_announcement'
)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. REPAIR MEETINGS & INVITATIONS RLS POLICIES
-- ------------------------------------------------------------------------------

-- Update meetings SELECT policy so all organization members can see org meetings
DROP POLICY IF EXISTS "Users can view workspace meetings" ON public.meetings;
CREATE POLICY "Users can view workspace meetings" ON public.meetings
FOR SELECT TO authenticated
USING (
  host_id = auth.uid()
  OR auth_is_meeting_participant(id)
  OR (workspace_id IN (
    SELECT w.id FROM public.workspaces w
    WHERE w.organization_id IN (
      SELECT uo.org_id FROM public.user_organizations uo WHERE uo.user_id = auth.uid()
      UNION
      SELECT o.id FROM public.organizations o WHERE o.owner_id = auth.uid()
    )
    UNION
    SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
  ))
);

-- Ensure unique constraint on meeting_participants (meeting_id, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meeting_participants_meeting_id_user_id_key'
  ) THEN
    ALTER TABLE public.meeting_participants 
    ADD CONSTRAINT meeting_participants_meeting_id_user_id_key UNIQUE (meeting_id, user_id);
  END IF;
END $$;

-- Allow participants to update their own status
DROP POLICY IF EXISTS "Participants can update their own status" ON public.meeting_participants;
CREATE POLICY "Participants can update their own status" ON public.meeting_participants
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Update meeting_invitations UPDATE policy
DROP POLICY IF EXISTS "Users can update their own invitations" ON public.meeting_invitations;
CREATE POLICY "Users can update their own invitations" ON public.meeting_invitations
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Helper RPC: respond_to_meeting_invitation

CREATE OR REPLACE FUNCTION public.respond_to_meeting_invitation(
  p_meeting_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_clean_status text;
  v_res jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_clean_status := LOWER(TRIM(p_status));
  IF v_clean_status NOT IN ('accepted', 'declined', 'tentative') THEN
    RAISE EXCEPTION 'Invalid invitation status: %', v_clean_status USING ERRCODE = '22023';
  END IF;

  -- Update or insert invitation
  INSERT INTO public.meeting_invitations (meeting_id, user_id, status, accepted_at)
  VALUES (p_meeting_id, v_user_id, v_clean_status, CASE WHEN v_clean_status = 'accepted' THEN now() ELSE NULL END)
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET
    status = EXCLUDED.status,
    accepted_at = EXCLUDED.accepted_at;

  -- Synchronize meeting_participants
  INSERT INTO public.meeting_participants (
    meeting_id, user_id, role, status, admission_status
  ) VALUES (
    p_meeting_id,
    v_user_id,
    'attendee',
    v_clean_status,
    CASE WHEN v_clean_status = 'accepted' THEN 'admitted' ELSE 'waiting' END
  )
  ON CONFLICT (meeting_id, user_id) DO UPDATE SET
    status = EXCLUDED.status,
    admission_status = CASE WHEN v_clean_status = 'accepted' THEN 'admitted' ELSE meeting_participants.admission_status END;

  SELECT jsonb_build_object(
    'success', true,
    'meeting_id', p_meeting_id,
    'user_id', v_user_id,
    'status', v_clean_status,
    'message', 'Invitation response updated successfully.'
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_meeting_invitation(uuid, text) TO authenticated;
