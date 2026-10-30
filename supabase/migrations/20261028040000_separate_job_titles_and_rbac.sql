-- ==============================================================================
-- AUVRYN — Separation of Professional Job Titles and RBAC Access Roles
-- Migration: 20261028040000_separate_job_titles_and_rbac.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BACKFILL EMPTY JOB TITLES WITH PROFESSIONAL DEFAULTS
-- ------------------------------------------------------------------------------
UPDATE public.user_organizations
SET job_title = CASE 
  WHEN role = 'owner' THEN 'Founder'
  WHEN role = 'administrator' THEN 'Managing Director (MD)'
  WHEN role = 'manager' THEN 'Product Manager'
  ELSE 'Software Engineer'
END
WHERE job_title IS NULL OR TRIM(job_title) = '';

UPDATE public.users
SET job_title = CASE 
  WHEN role::text = 'owner' THEN 'Founder'
  WHEN role::text = 'administrator' THEN 'Managing Director (MD)'
  WHEN role::text = 'manager' THEN 'Product Manager'
  ELSE 'Software Engineer'
END
WHERE (job_title IS NULL OR TRIM(job_title) = '') AND account_type = 'organization';

-- ------------------------------------------------------------------------------
-- 2. DEDICATED RPC: UPDATE ORGANIZATION MEMBER JOB TITLE (INDEPENDENT OF RBAC)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_organization_member_job_title(
  p_org_id uuid,
  p_target_user_id uuid,
  p_job_title text
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
  v_clean_title text;
  v_target_old_title text;
  v_target_email text;
  v_target_full_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- 1. Check if caller is org owner or has management authority or is editing own profile
  SELECT (owner_id = v_caller_id) INTO v_is_org_owner
  FROM public.organizations
  WHERE id = p_org_id;

  SELECT role INTO v_caller_role
  FROM public.user_organizations
  WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    v_caller_id = p_target_user_id
    OR COALESCE(v_is_org_owner, false) = true
    OR v_caller_role = ANY(ARRAY['owner', 'administrator', 'manager']::varchar[])
    OR public.has_org_permission(v_caller_id, p_org_id, 'members.update')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to update job titles in this organization.' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify target membership
  SELECT job_title INTO v_target_old_title
  FROM public.user_organizations
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected user is not a member of this organization.' USING ERRCODE = 'P0002';
  END IF;

  v_clean_title := NULLIF(TRIM(p_job_title), '');
  IF v_clean_title IS NULL THEN
    v_clean_title := 'Team Member';
  END IF;

  -- 3. Update user_organizations (DO NOT TOUCH ROLE OR PERMISSIONS)
  UPDATE public.user_organizations
  SET job_title = v_clean_title
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- 4. Sync users profile
  UPDATE public.users
  SET job_title = v_clean_title
  WHERE id = p_target_user_id;

  -- 5. Record activity log
  SELECT email, full_name INTO v_target_email, v_target_full_name
  FROM public.users WHERE id = p_target_user_id;

  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value, new_value
  ) VALUES (
    p_org_id,
    v_caller_id,
    'member_job_title_updated',
    'user_organizations',
    p_target_user_id,
    jsonb_build_object('job_title', v_target_old_title),
    jsonb_build_object('job_title', v_clean_title, 'target_email', v_target_email, 'target_name', v_target_full_name)
  );

  RETURN jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'user_id', p_target_user_id,
    'old_job_title', v_target_old_title,
    'new_job_title', v_clean_title,
    'message', format('Successfully updated job title to "%s".', v_clean_title)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. UPDATE UPDATE_ORGANIZATION_MEMBER_ROLE WITH OPTIONAL JOB TITLE UPDATE
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_organization_member_role(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.update_organization_member_role(
  p_org_id uuid,
  p_target_user_id uuid,
  p_new_role text,
  p_job_title text DEFAULT NULL
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
  v_target_old_title varchar;
  v_target_email text;
  v_target_full_name text;
  v_org_name text;
  v_clean_role varchar;
  v_clean_title text;
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

  -- 5. Anti-self-elevation: Users cannot edit their own access role
  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Security violation: Users cannot modify their own access role.' USING ERRCODE = '42501';
  END IF;

  -- 6. Verify target membership in organization
  SELECT role, job_title INTO v_target_old_role, v_target_old_title
  FROM public.user_organizations
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected user is not a member of this organization.' USING ERRCODE = 'P0002';
  END IF;

  -- 7. Owner protection: The primary organization owner cannot be modified or demoted
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Security violation: The primary organization owner cannot be modified or demoted.' USING ERRCODE = '42501';
  END IF;

  -- 8. Clean and validate new access role
  v_clean_role := LOWER(TRIM(p_new_role));
  IF v_clean_role = 'employee' THEN
    v_clean_role := 'team_member';
  END IF;

  IF NOT (v_clean_role = ANY(ARRAY['owner', 'administrator', 'manager', 'team_lead', 'team_member', 'guest', 'client']::varchar[])) THEN
    RAISE EXCEPTION 'Invalid access role: %. Must be a valid RBAC role.', v_clean_role USING ERRCODE = '22023';
  END IF;

  -- 9. Privilege hierarchy enforcement
  IF v_clean_role IN ('owner', 'administrator') AND NOT (
    COALESCE(v_is_org_owner, false) = true 
    OR v_caller_role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Permission denied. Only organization owners can grant administrator or owner roles.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role = 'manager' AND v_clean_role IN ('administrator', 'owner') THEN
    RAISE EXCEPTION 'Permission denied. You cannot assign a role higher than your own management tier.' USING ERRCODE = '42501';
  END IF;

  -- Optional clean job title
  v_clean_title := NULLIF(TRIM(p_job_title), '');

  -- 10. Update public.user_organizations
  UPDATE public.user_organizations
  SET role = v_clean_role,
      job_title = COALESCE(v_clean_title, user_organizations.job_title)
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- 11. Synchronize public.users profile
  UPDATE public.users
  SET role = v_clean_role::public.user_role,
      job_title = COALESCE(v_clean_title, public.users.job_title),
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
    'member_access_updated',
    'user_organizations',
    p_target_user_id,
    jsonb_build_object('role', v_target_old_role, 'job_title', v_target_old_title),
    jsonb_build_object('role', v_clean_role, 'job_title', COALESCE(v_clean_title, v_target_old_title), 'target_email', v_target_email, 'target_name', v_target_full_name)
  );

  SELECT jsonb_build_object(
    'success', true,
    'org_id', p_org_id,
    'user_id', p_target_user_id,
    'old_role', v_target_old_role,
    'new_role', v_clean_role,
    'job_title', COALESCE(v_clean_title, v_target_old_title),
    'message', format('Successfully updated %s access role to %s.', COALESCE(v_target_full_name, v_target_email, 'member'), REPLACE(v_clean_role, '_', ' '))
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. UPDATE APPROVE_ORGANIZATION_JOIN_REQUEST TO SUPPORT ASSIGNED JOB TITLE
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.approve_organization_join_request(uuid, text, uuid, text);

CREATE OR REPLACE FUNCTION public.approve_organization_join_request(
  p_request_id uuid,
  p_assigned_role text DEFAULT 'team_member'::text,
  p_department_id uuid DEFAULT NULL::uuid,
  p_notes text DEFAULT NULL::text,
  p_assigned_job_title text DEFAULT NULL::text
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
  v_clean_role varchar;
  v_clean_title text;
  v_dept_id uuid := NULL;
  v_res jsonb;
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
    RAISE EXCEPTION 'This join request has already been processed (status: %).', v_req.status USING ERRCODE = '22023';
  END IF;

  IF v_req.user_id = v_caller_id THEN
    RAISE EXCEPTION 'Security violation: Users cannot approve their own join requests.' USING ERRCODE = '42501';
  END IF;

  -- Verify management authority
  SELECT role INTO v_caller_role
  FROM public.user_organizations
  WHERE org_id = v_req.org_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL OR NOT (
    v_caller_role = ANY(ARRAY['owner', 'administrator', 'manager']::varchar[])
    OR public.has_org_permission(v_caller_id, v_req.org_id, 'members.invite')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to approve join requests.' USING ERRCODE = '42501';
  END IF;

  -- Normalize assigned role to clean built-in roles
  v_clean_role := COALESCE(NULLIF(TRIM(p_assigned_role), ''), 'team_member');
  IF v_clean_role = 'employee' THEN
    v_clean_role := 'team_member';
  END IF;

  IF NOT (v_clean_role = ANY(ARRAY['administrator', 'manager', 'team_lead', 'team_member', 'guest', 'client']::varchar[])) THEN
    RAISE EXCEPTION 'Invalid role assignment: %. Must be a valid application access role.', v_clean_role USING ERRCODE = '22023';
  END IF;

  IF v_clean_role = 'administrator' AND v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Permission denied. Only organization owners can assign administrator roles.' USING ERRCODE = '42501';
  END IF;

  -- Resolve Job Title (Explicitly assigned title > applicant requested title > default)
  v_clean_title := COALESCE(
    NULLIF(TRIM(p_assigned_job_title), ''),
    NULLIF(TRIM(v_req.job_title), ''),
    'Software Engineer'
  );

  -- Optional department verification
  IF p_department_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.departments WHERE id = p_department_id AND org_id = v_req.org_id AND is_deleted = false) THEN
      v_dept_id := p_department_id;
    END IF;
  END IF;

  -- Insert into user_organizations
  INSERT INTO public.user_organizations (
    user_id, org_id, role, job_title, department_id, joined_at, invited_by
  ) VALUES (
    v_req.user_id,
    v_req.org_id,
    v_clean_role,
    v_clean_title,
    v_dept_id,
    now(),
    v_caller_id
  )
  ON CONFLICT (user_id, org_id) DO UPDATE SET
    role = EXCLUDED.role,
    job_title = EXCLUDED.job_title,
    department_id = COALESCE(EXCLUDED.department_id, user_organizations.department_id);

  -- Update public.users profile
  UPDATE public.users
  SET account_type = 'organization',
      role = v_clean_role::public.user_role,
      job_title = v_clean_title,
      default_workspace_id = v_req.org_id::text,
      account_setup_completed = true
  WHERE id = v_req.user_id;

  -- Mark request as approved
  UPDATE public.organization_join_requests
  SET status = 'approved',
      reviewed_by = v_caller_id,
      reviewed_at = now(),
      assigned_role = v_clean_role,
      assigned_department_id = v_dept_id,
      review_notes = p_notes
  WHERE id = p_request_id;

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Successfully approved %s as %s (%s).', COALESCE(v_req.full_name, v_req.email), v_clean_title, v_clean_role)
  ) INTO v_res;

  RETURN v_res;
END;
$$;
