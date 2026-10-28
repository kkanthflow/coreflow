-- ==============================================================================
-- AUVRYN — Deletion of Legacy / Obsolete Roles System
-- Migration: 20261028030000_delete_legacy_roles_system.sql
--
-- Objective:
-- Completely delete obsolete roles, role assignments, hardcoded role checks,
-- obsolete role-generation logic, unused legacy tables, and legacy RLS policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. MIGRATE EXISTING ROLE ASSIGNMENTS BEFORE DELETION (NO SILENT ACCESS LOSS)
-- ------------------------------------------------------------------------------

-- A. user_organizations
-- Ensure organization owners are 'owner'
UPDATE public.user_organizations uo
SET role = 'owner'
FROM public.organizations o
WHERE o.id = uo.org_id AND o.owner_id = uo.user_id AND uo.role != 'owner';

-- Migrate obsolete management roles to 'manager'
UPDATE public.user_organizations
SET role = 'manager',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Director')
WHERE role = 'director';

UPDATE public.user_organizations
SET role = 'manager',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Senior Manager')
WHERE role = 'senior_manager';

UPDATE public.user_organizations
SET role = 'manager',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'HR Manager')
WHERE role = 'hr';

-- Migrate obsolete admin role to 'administrator'
UPDATE public.user_organizations
SET role = 'administrator'
WHERE role = 'admin';

-- Migrate obsolete contributor roles to 'team_member'
UPDATE public.user_organizations
SET role = 'team_member',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Developer')
WHERE role IN ('developer', 'senior_employee');

UPDATE public.user_organizations
SET role = 'team_member',
    job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Intern')
WHERE role = 'intern';

UPDATE public.user_organizations
SET role = 'team_member'
WHERE role IN ('general_member', 'freelancer', 'employee');

-- B. public.users
UPDATE public.users
SET role = 'owner'::public.user_role
WHERE role::text IN ('managing_director', 'ceo', 'cto');

UPDATE public.users
SET role = 'administrator'::public.user_role
WHERE role::text = 'admin';

UPDATE public.users
SET role = 'manager'::public.user_role
WHERE role::text IN ('director', 'senior_manager', 'hr');

UPDATE public.users
SET role = 'team_member'::public.user_role
WHERE role::text IN ('developer', 'intern', 'senior_employee', 'general_member', 'freelancer', 'employee');

-- ------------------------------------------------------------------------------
-- 2. DELETE OBSOLETE ROLES FROM public.roles
-- ------------------------------------------------------------------------------
DELETE FROM public.roles
WHERE role_name IN (
  'managing_director', 'ceo', 'cto', 'admin', 'director', 'senior_manager',
  'project_manager', 'hr', 'senior_employee', 'intern', 'developer',
  'general_member', 'department_head', 'freelancer'
);

-- ------------------------------------------------------------------------------
-- 3. DROP UNUSED OBSOLETE ROLE TABLES
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.workspace_member_roles CASCADE;
DROP TABLE IF EXISTS public.workspace_role_permissions CASCADE;
DROP TABLE IF EXISTS public.workspace_roles CASCADE;
DROP TABLE IF EXISTS public.role_change_audit CASCADE;

-- ------------------------------------------------------------------------------
-- 4. UPDATE LEGACY RLS POLICIES REMOVING OBSOLETE ROLE CHECKS
-- ------------------------------------------------------------------------------

-- user_organizations: Admins can add org members
DROP POLICY IF EXISTS "Admins can add org members" ON public.user_organizations;
CREATE POLICY "Admins can add org members" ON public.user_organizations
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = user_organizations.org_id AND o.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = user_organizations.org_id 
      AND uo.user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'administrator', 'manager') 
        OR public.has_org_permission(auth.uid(), user_organizations.org_id, 'members.invite')
      )
  )
);

-- user_organizations: Admins can remove org members
DROP POLICY IF EXISTS "Admins can remove org members" ON public.user_organizations;
CREATE POLICY "Admins can remove org members" ON public.user_organizations
FOR DELETE TO authenticated
USING (
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
      WHERE uo.org_id = user_organizations.org_id 
        AND uo.user_id = auth.uid()
        AND (
          uo.role IN ('owner', 'administrator') 
          OR public.has_org_permission(auth.uid(), user_organizations.org_id, 'members.remove')
        )
    )
  )
);

-- user_organizations: Org admins can update user memberships
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
    WHERE uo.org_id = user_organizations.org_id 
      AND uo.user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'administrator') 
        OR public.has_org_permission(auth.uid(), user_organizations.org_id, 'members.assign_roles')
      )
  )
);

-- projects: Authorized roles can delete projects
DROP POLICY IF EXISTS "Authorized roles can delete projects" ON public.projects;
CREATE POLICY "Authorized roles can delete projects" ON public.projects
FOR DELETE TO authenticated
USING (
  created_by = auth.uid() 
  OR owner_id = auth.uid() 
  OR (
    org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = projects.org_id 
        AND uo.user_id = auth.uid() 
        AND (
          uo.role IN ('owner', 'administrator') 
          OR public.has_org_permission(auth.uid(), projects.org_id, 'projects.delete')
        )
    )
  )
);

-- projects: Authorized roles can insert projects
DROP POLICY IF EXISTS "Authorized roles can insert projects" ON public.projects;
CREATE POLICY "Authorized roles can insert projects" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    org_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = projects.org_id 
        AND uo.user_id = auth.uid() 
        AND (
          uo.role IN ('owner', 'administrator', 'manager', 'team_lead', 'team_member') 
          OR public.has_org_permission(auth.uid(), projects.org_id, 'projects.create')
        )
    )
  )
);

-- users: Update users
DROP POLICY IF EXISTS "Update users" ON public.users;
CREATE POLICY "Update users" ON public.users
FOR UPDATE TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_organizations uo1
    JOIN public.user_organizations uo2 ON uo1.org_id = uo2.org_id
    WHERE uo1.user_id = auth.uid() 
      AND uo2.user_id = users.id 
      AND uo1.role IN ('owner', 'administrator')
  )
);

-- security_events: Admins can view security events
DROP POLICY IF EXISTS "Admins can view security events" ON public.security_events;
CREATE POLICY "Admins can view security events" ON public.security_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role::text IN ('owner', 'administrator')
  )
);

-- login_attempts: Admins can view login attempts
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view login attempts" ON public.login_attempts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role::text IN ('owner', 'administrator')
  )
);

-- test_accounts: Only admins can view test accounts
DROP POLICY IF EXISTS "Only admins can view test accounts" ON public.test_accounts;
CREATE POLICY "Only admins can view test accounts" ON public.test_accounts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role::text IN ('owner', 'administrator')
  )
);

-- test_accounts: Only admins can delete test accounts
DROP POLICY IF EXISTS "Only admins can delete test accounts" ON public.test_accounts;
CREATE POLICY "Only admins can delete test accounts" ON public.test_accounts
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role::text IN ('owner', 'administrator')
  )
);

-- rate_limit_locks: Admins can view rate limit locks
DROP POLICY IF EXISTS "Admins can view rate limit locks" ON public.rate_limit_locks;
CREATE POLICY "Admins can view rate limit locks" ON public.rate_limit_locks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role::text IN ('owner', 'administrator')
  )
);

-- rate_limit_locks: Admins can delete rate limit locks
DROP POLICY IF EXISTS "Admins can delete rate limit locks" ON public.rate_limit_locks;
CREATE POLICY "Admins can delete rate limit locks" ON public.rate_limit_locks
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role::text IN ('owner', 'administrator')
  )
);

-- device_security: Admins can view device security
DROP POLICY IF EXISTS "Admins can view device security" ON public.device_security;
CREATE POLICY "Admins can view device security" ON public.device_security
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role::text IN ('owner', 'administrator')
  )
);

-- organization_join_requests: Managers can view org join requests
DROP POLICY IF EXISTS "Managers can view org join requests" ON public.organization_join_requests;
CREATE POLICY "Managers can view org join requests" ON public.organization_join_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = organization_join_requests.org_id
      AND uo.user_id = auth.uid()
      AND uo.role IN ('owner', 'administrator', 'manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_join_requests.org_id AND o.owner_id = auth.uid()
  )
);

-- workflows: workflows_authenticated_insert
DROP POLICY IF EXISTS "workflows_authenticated_insert" ON public.workflows;
CREATE POLICY "workflows_authenticated_insert" ON public.workflows
FOR INSERT TO authenticated
WITH CHECK (
  (account_type = 'freelancer' AND account_id::text = auth.uid()::text)
  OR (
    account_type = 'organization' AND EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id::text = workflows.account_id::text
        AND uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'administrator', 'manager')
    )
  )
);

-- workflows: workflows_authenticated_update
DROP POLICY IF EXISTS "workflows_authenticated_update" ON public.workflows;
CREATE POLICY "workflows_authenticated_update" ON public.workflows
FOR UPDATE TO authenticated
USING (
  (account_type = 'freelancer' AND (account_id::text = auth.uid()::text OR created_by = auth.uid()))
  OR (
    account_type = 'organization' AND EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id::text = workflows.account_id::text
        AND uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'administrator', 'manager')
    )
  )
);

-- tasks: Users can view tasks of accessible projects
DROP POLICY IF EXISTS "Users can view tasks of accessible projects" ON public.tasks;
CREATE POLICY "Users can view tasks of accessible projects" ON public.tasks
FOR SELECT TO authenticated
USING (
  (project_id IS NOT NULL AND public.can_view_project(auth.uid(), project_id))
  OR (
    project_id IS NULL AND (
      created_by = auth.uid()
      OR assignee_id = auth.uid()
      OR (
        org_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_organizations uo
          WHERE uo.org_id = tasks.org_id
            AND uo.user_id = auth.uid()
            AND uo.role IN ('owner', 'administrator', 'manager')
        )
      )
    )
  )
);

-- project_members: Managers can update project members
DROP POLICY IF EXISTS "Managers can update project members" ON public.project_members;
CREATE POLICY "Managers can update project members" ON public.project_members
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.user_organizations uo ON uo.org_id = p.org_id
    WHERE p.id = project_members.project_id
      AND uo.user_id = auth.uid()
      AND uo.role IN ('owner', 'administrator', 'manager')
  )
);

-- channel_members: Users can insert channel members
DROP POLICY IF EXISTS "Users can insert channel members" ON public.channel_members;
CREATE POLICY "Users can insert channel members" ON public.channel_members
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_channels cc
    WHERE cc.id = channel_members.channel_id AND cc.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = channel_members.channel_id AND cm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.chat_channels cc
    JOIN public.user_organizations uo ON uo.org_id = cc.org_id
    WHERE cc.id = channel_members.channel_id
      AND uo.user_id = auth.uid()
      AND uo.role IN ('owner', 'administrator', 'manager')
  )
);

-- channel_members: Users can leave or remove channel members
DROP POLICY IF EXISTS "Users can leave or remove channel members" ON public.channel_members;
CREATE POLICY "Users can leave or remove channel members" ON public.channel_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_channels cc
    WHERE cc.id = channel_members.channel_id AND cc.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.chat_channels cc
    JOIN public.user_organizations uo ON uo.org_id = cc.org_id
    WHERE cc.id = channel_members.channel_id
      AND uo.user_id = auth.uid()
      AND uo.role IN ('owner', 'administrator', 'manager')
  )
);

-- ------------------------------------------------------------------------------
-- 5. UPDATE / PURGE OBSOLETE ROLE-GENERATION TRIGGERS & ROUTINES
-- ------------------------------------------------------------------------------

-- handle_new_user: Stops assigning obsolete role 'general_member'
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
    IF v_role_str IN ('owner', 'administrator', 'manager', 'team_lead', 'team_member') THEN
      v_role := v_role_str::public.user_role;
    ELSE
      v_role := 'team_member'::public.user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'team_member'::public.user_role;
  END;

  BEGIN
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
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.users
    SET email = new.email,
        full_name = COALESCE(public.users.full_name, v_full_name)
    WHERE email = new.email OR id = new.id;
  END;
  
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

-- get_organization_join_requests: Drop first to clear OUT parameter mismatch, then recreate
DROP FUNCTION IF EXISTS public.get_organization_join_requests(uuid, text);

CREATE OR REPLACE FUNCTION public.get_organization_join_requests(
  p_org_id uuid,
  p_status text DEFAULT 'pending'::text
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  user_id uuid,
  full_name character varying,
  email character varying,
  job_title character varying,
  department_id uuid,
  department_name text,
  status character varying,
  created_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  assigned_role character varying,
  assigned_department_id uuid,
  review_notes text,
  applicant_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role varchar;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT uo.role INTO v_caller_role
  FROM public.user_organizations uo
  WHERE uo.org_id = p_org_id AND uo.user_id = v_caller_id;

  IF v_caller_role IS NULL OR NOT (
    v_caller_role = ANY(ARRAY['owner', 'administrator', 'manager']::varchar[])
    OR public.has_org_permission(v_caller_id, p_org_id, 'members.view')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to review join requests for this organization.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT 
    r.id,
    r.org_id,
    r.user_id,
    r.full_name,
    r.email,
    r.job_title,
    r.department_id,
    d.name AS department_name,
    r.status,
    r.created_at,
    r.reviewed_at,
    r.reviewed_by,
    r.assigned_role,
    r.assigned_department_id,
    r.review_notes,
    u.avatar_url AS applicant_avatar_url
  FROM public.organization_join_requests r
  LEFT JOIN public.departments d ON d.id = r.department_id
  LEFT JOIN public.users u ON u.id = r.user_id
  WHERE r.org_id = p_org_id
    AND (p_status IS NULL OR p_status = 'ALL' OR r.status = p_status)
  ORDER BY r.created_at DESC;
END;
$$;

-- reject_organization_join_request: Remove obsolete roles check
CREATE OR REPLACE FUNCTION public.reject_organization_join_request(
  p_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role varchar;
  v_req record;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.organization_join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'This join request has already been processed.' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.user_organizations
  WHERE org_id = v_req.org_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL OR NOT (
    v_caller_role = ANY(ARRAY['owner', 'administrator', 'manager']::varchar[])
    OR public.has_org_permission(v_caller_id, v_req.org_id, 'members.invite')
  ) THEN
    RAISE EXCEPTION 'Access denied.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.organization_join_requests
  SET status = 'rejected',
      reviewed_by = v_caller_id,
      reviewed_at = now(),
      review_notes = p_notes
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'rejected',
    'message', 'Join request has been rejected.'
  );
END;
$$;

-- update_organization_member_role: Remove obsolete roles check
CREATE OR REPLACE FUNCTION public.update_organization_member_role(
  p_org_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    OR v_caller_role = ANY(ARRAY['owner', 'administrator', 'manager']::varchar[])
    OR public.has_org_permission(v_caller_id, p_org_id, 'members.assign_roles')
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
  IF v_clean_role = 'employee' THEN
    v_clean_role := 'team_member';
  END IF;

  IF NOT (v_clean_role = ANY(ARRAY['owner', 'administrator', 'manager', 'team_lead', 'team_member', 'guest', 'client']::varchar[])) THEN
    RAISE EXCEPTION 'Invalid role name: %. Role does not exist in system roles.', v_clean_role USING ERRCODE = '22023';
  END IF;

  -- 9. Privilege hierarchy enforcement
  -- Only the organization owner can grant owner or administrator roles
  IF v_clean_role IN ('owner', 'administrator') AND NOT (
    COALESCE(v_is_org_owner, false) = true 
    OR v_caller_role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Permission denied. Only organization owners can grant administrator or owner roles.' USING ERRCODE = '42501';
  END IF;

  -- Ordinary managers cannot promote above their own role rank
  IF v_caller_role = 'manager' AND v_clean_role IN ('administrator', 'owner') THEN
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

-- can_manage_project: Replace function body keeping identical signature so dependent policies stay intact
CREATE OR REPLACE FUNCTION public.can_manage_project(
  p_user_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_dept_id UUID;
  v_owner_id UUID;
  v_created_by UUID;
  v_user_role VARCHAR(50);
  v_member_role VARCHAR(50);
BEGIN
  IF p_user_id IS NULL OR p_project_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT org_id, department_id, owner_id, created_by
  INTO v_org_id, v_dept_id, v_owner_id, v_created_by
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Independent project
  IF v_org_id IS NULL THEN
    RETURN (v_owner_id = p_user_id OR v_created_by = p_user_id);
  END IF;

  -- Organization project
  SELECT role
  INTO v_user_role
  FROM public.user_organizations
  WHERE org_id = v_org_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Owner / Administrator / Manager can manage projects if organization-scoped
  IF v_user_role IN ('owner', 'administrator', 'manager') THEN
    RETURN TRUE;
  END IF;

  -- Project Lead / Manager in project_members
  SELECT role INTO v_member_role
  FROM public.project_members
  WHERE project_id = p_project_id 
    AND user_id = p_user_id 
    AND COALESCE(is_active, true) = true;

  IF v_member_role IN ('owner', 'manager', 'lead') THEN
    RETURN TRUE;
  END IF;

  IF v_owner_id = p_user_id OR v_created_by = p_user_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- update_custom_role: Remove managing_director, ceo
CREATE OR REPLACE FUNCTION public.update_custom_role(
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permissions jsonb,
  p_scope_limits jsonb,
  p_is_active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_org_id uuid;
  v_is_owner boolean;
  v_caller_role text;
  v_is_system boolean;
  v_requested_perm text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, is_system INTO v_org_id, v_is_system FROM public.organization_roles WHERE id = p_role_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom role not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = v_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = v_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator')
    OR public.has_org_permission(v_caller_id, v_org_id, 'roles.update')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to edit roles in this organization.' USING ERRCODE = '42501';
  END IF;

  -- Anti-privilege escalation
  IF COALESCE(v_is_owner, false) = false AND v_caller_role != 'owner' THEN
    FOR v_requested_perm IN SELECT jsonb_array_elements_text(p_permissions) LOOP
      IF NOT public.has_org_permission(v_caller_id, v_org_id, v_requested_perm) THEN
        RAISE EXCEPTION 'Privilege escalation blocked: You cannot grant permission "%" which you do not possess.', v_requested_perm USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.organization_roles
  SET name = TRIM(p_name),
      description = p_description,
      permissions = p_permissions,
      scope_limits = p_scope_limits,
      is_active = p_is_active,
      updated_at = now()
  WHERE id = p_role_id;

  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    v_org_id, v_caller_id, 'custom_role_updated', 'organization_roles', p_role_id,
    jsonb_build_object('name', p_name, 'is_active', p_is_active)
  );

  SELECT jsonb_build_object(
    'success', true,
    'role_id', p_role_id,
    'message', format('Custom role "%s" updated successfully.', p_name)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- delete_custom_role: Remove managing_director, ceo
CREATE OR REPLACE FUNCTION public.delete_custom_role(p_role_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_org_id uuid;
  v_is_owner boolean;
  v_caller_role text;
  v_is_system boolean;
  v_role_name text;
  v_affected_members int;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, is_system, name INTO v_org_id, v_is_system, v_role_name 
  FROM public.organization_roles WHERE id = p_role_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Custom role not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_is_system THEN
    RAISE EXCEPTION 'System roles cannot be deleted.' USING ERRCODE = '42501';
  END IF;

  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = v_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = v_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator')
    OR public.has_org_permission(v_caller_id, v_org_id, 'roles.delete')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to delete roles in this organization.' USING ERRCODE = '42501';
  END IF;

  -- Reassign members using this custom role back to base team_member role
  UPDATE public.user_organizations
  SET custom_role_id = NULL,
      role = COALESCE(NULLIF(role, ''), 'team_member')
  WHERE org_id = v_org_id AND custom_role_id = p_role_id;
  GET DIAGNOSTICS v_affected_members = ROW_COUNT;

  DELETE FROM public.organization_roles WHERE id = p_role_id;

  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value
  ) VALUES (
    v_org_id, v_caller_id, 'custom_role_deleted', 'organization_roles', p_role_id,
    jsonb_build_object('name', v_role_name, 'affected_members', v_affected_members)
  );

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Custom role "%s" deleted. %s member(s) reverted to base role.', v_role_name, v_affected_members)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- change_user_role: Drop both variations first, then recreate
DROP FUNCTION IF EXISTS public.change_user_role(uuid, public.user_role, text);
DROP FUNCTION IF EXISTS public.change_user_role(uuid, text, text);

CREATE OR REPLACE FUNCTION public.change_user_role(
  p_user_id uuid,
  p_new_role public.user_role,
  p_reason text DEFAULT NULL::text
)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role public.user_role;
  v_current_user_id UUID;
  v_caller_role text;
BEGIN
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Authentication required'::TEXT;
    RETURN;
  END IF;
  
  -- Check if current user is admin/owner
  SELECT role::text INTO v_caller_role FROM public.users WHERE id = v_current_user_id;
  IF v_caller_role NOT IN ('owner', 'administrator') THEN
    RETURN QUERY SELECT FALSE, 'Only organization owners or administrators can change roles'::TEXT;
    RETURN;
  END IF;
  
  SELECT role INTO v_old_role FROM public.users WHERE id = p_user_id;
  
  UPDATE public.users 
  SET role = p_new_role 
  WHERE id = p_user_id;
  
  RETURN QUERY SELECT TRUE, 'Role updated successfully'::TEXT;
END;
$$;

-- create_user_with_role: Drop and recreate with default team_member
DROP FUNCTION IF EXISTS public.create_user_with_role(character varying, character varying, public.user_role);

CREATE OR REPLACE FUNCTION public.create_user_with_role(
  p_email character varying,
  p_full_name character varying,
  p_role public.user_role DEFAULT 'team_member'::public.user_role
)
RETURNS TABLE(id uuid, email character varying, full_name character varying, role public.user_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.users (email, full_name, role)
  VALUES (p_email, p_full_name, p_role)
  RETURNING users.id, users.email, users.full_name, users.role;
END;
$$;

-- get_auth_logs: Update admin check
DROP FUNCTION IF EXISTS public.get_auth_logs();

CREATE OR REPLACE FUNCTION public.get_auth_logs()
RETURNS TABLE(id uuid, payload jsonb, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is owner or administrator
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role::text IN ('owner', 'administrator')
  ) THEN
    RAISE EXCEPTION 'Only administrators can view auth logs';
  END IF;

  RETURN QUERY SELECT * FROM private.get_auth_logs_internal();
END;
$$;

-- notify_invoice_updates: Update role checks to owner / administrator
CREATE OR REPLACE FUNCTION public.notify_invoice_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_owner RECORD;
  client_title TEXT := 'Client';
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT COALESCE(company_name, name) INTO client_title
    FROM public.clients
    WHERE id = NEW.client_id;
    IF client_title IS NULL THEN
      client_title := 'Client';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.organization_id IS NOT NULL THEN
      FOR org_owner IN
        SELECT u.id
        FROM public.users u
        JOIN public.user_organizations uo ON u.id = uo.user_id
        WHERE uo.org_id = NEW.organization_id 
          AND (u.role::TEXT IN ('owner', 'administrator') OR uo.role IN ('owner', 'administrator'))
      LOOP
        BEGIN
          INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
          VALUES (
            org_owner.id,
            'Invoice Created',
            'New invoice (' || COALESCE(NEW.invoice_number, 'Draft') || ') for ' || client_title,
            'invoice_created',
            NEW.id,
            'invoice',
            '/invoices/' || NEW.id::TEXT,
            FALSE
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING '[notify_invoice_updates] Failed to insert notification: %', SQLERRM;
        END;
      END LOOP;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.organization_id IS NOT NULL THEN
      IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
        FOR org_owner IN
          SELECT u.id
          FROM public.users u
          JOIN public.user_organizations uo ON u.id = uo.user_id
          WHERE uo.org_id = NEW.organization_id 
            AND (u.role::TEXT IN ('owner', 'administrator') OR uo.role IN ('owner', 'administrator'))
        LOOP
          BEGIN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
            VALUES (
              org_owner.id,
              'Invoice Paid 💰',
              'Payment received for invoice ' || COALESCE(NEW.invoice_number, 'Invoice'),
              'invoice_paid',
              NEW.id,
              'invoice',
              '/invoices/' || NEW.id::TEXT,
              FALSE
            );
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[notify_invoice_updates] Failed to insert notification: %', SQLERRM;
          END;
        END LOOP;
      ELSIF NEW.status = 'overdue' AND (OLD.status IS NULL OR OLD.status != 'overdue') THEN
        FOR org_owner IN
          SELECT u.id
          FROM public.users u
          JOIN public.user_organizations uo ON u.id = uo.user_id
          WHERE uo.org_id = NEW.organization_id 
            AND (u.role::TEXT IN ('owner', 'administrator') OR uo.role IN ('owner', 'administrator'))
        LOOP
          BEGIN
            INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
            VALUES (
              org_owner.id,
              'Invoice Overdue ⚠️',
              'Invoice ' || COALESCE(NEW.invoice_number, 'Invoice') || ' is now overdue',
              'invoice_overdue',
              NEW.id,
              'invoice',
              '/invoices/' || NEW.id::TEXT,
              FALSE
            );
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[notify_invoice_updates] Failed to insert notification: %', SQLERRM;
          END;
        END LOOP;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- accept_project_client_invite: Clean obsolete roles check
CREATE OR REPLACE FUNCTION public.accept_project_client_invite(
  p_token text, 
  p_user_id uuid, 
  p_user_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.project_invites%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_norm_email TEXT;
BEGIN
  v_norm_email := LOWER(TRIM(p_user_email));

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

  UPDATE public.clients
  SET user_id = p_user_id,
      updated_at = now()
  WHERE id = v_invite.client_id;

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

  -- Cleaned: Use non-obsolete roles
  UPDATE public.users
  SET 
    account_type = 'client',
    account_setup_completed = true,
    role = CASE 
      WHEN role::text IN ('owner', 'administrator', 'manager', 'team_lead', 'team_member') THEN role 
      ELSE 'client'::public.user_role 
    END,
    updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.project_invites
  SET 
    status = 'accepted',
    accepted_at = now(),
    accepted_by = p_user_id,
    accepted_email = v_norm_email,
    updated_at = now()
  WHERE id = v_invite.id;

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
