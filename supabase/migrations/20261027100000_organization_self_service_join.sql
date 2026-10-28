-- ==============================================================================
-- AUVRYN: ORGANIZATION SELF-SERVICE JOINING WORKFLOW
-- 1. Create organization_join_requests table
-- 2. Add discoverability to organizations
-- 3. RLS policies for join requests and hardened user_organizations
-- 4. Secure RPC functions for search, request, review, approval & rejection
-- ==============================================================================

-- 1. Add is_discoverable column to organizations if not present
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN DEFAULT true;

UPDATE public.organizations 
SET is_discoverable = true 
WHERE is_discoverable IS NULL;

-- 2. Create organization_join_requests table
CREATE TABLE IF NOT EXISTS public.organization_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  job_title VARCHAR(255),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_role VARCHAR(64),
  assigned_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  review_notes TEXT
);

-- Unique index to prevent duplicate pending requests for the same user and organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_join_requests_unique_pending
ON public.organization_join_requests (org_id, user_id)
WHERE status = 'pending';

-- Fast query indexes
CREATE INDEX IF NOT EXISTS idx_org_join_requests_user ON public.organization_join_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_org_join_requests_org ON public.organization_join_requests(org_id, status);

-- 3. RLS Policies on organization_join_requests
ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Applicants can view own join requests" ON public.organization_join_requests;
CREATE POLICY "Applicants can view own join requests"
ON public.organization_join_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers can view org join requests" ON public.organization_join_requests;
CREATE POLICY "Managers can view org join requests"
ON public.organization_join_requests FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = organization_join_requests.org_id
      AND uo.user_id = auth.uid()
      AND uo.role = ANY(ARRAY['owner', 'administrator', 'director', 'senior_manager', 'manager', 'managing_director', 'ceo', 'cto', 'hr']::varchar[])
  )
  OR
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = organization_join_requests.org_id AND o.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own pending join requests" ON public.organization_join_requests;
CREATE POLICY "Users can insert own pending join requests"
ON public.organization_join_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Applicants can cancel own pending requests" ON public.organization_join_requests;
CREATE POLICY "Applicants can cancel own pending requests"
ON public.organization_join_requests FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- Harden user_organizations INSERT policy: remove self-insertion hole
DROP POLICY IF EXISTS "Users can join an org or be added" ON public.user_organizations;
DROP POLICY IF EXISTS "Admins can add org members" ON public.user_organizations;
CREATE POLICY "Admins can add org members"
ON public.user_organizations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = user_organizations.org_id
      AND uo.user_id = auth.uid()
      AND uo.role = ANY(ARRAY['owner', 'administrator', 'director', 'senior_manager', 'manager', 'managing_director', 'ceo', 'cto', 'hr']::varchar[])
  )
  OR
  EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = user_organizations.org_id AND o.owner_id = auth.uid()
  )
);

-- 4. RPC Functions

-- Search discoverable organizations
CREATE OR REPLACE FUNCTION public.search_discoverable_organizations(p_query text)
RETURNS TABLE (
  id uuid,
  name varchar,
  industry text,
  size_category text,
  logo_url text,
  created_at timestamptz,
  member_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_query IS NULL OR TRIM(p_query) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.industry,
    o.size_category,
    o.logo_url,
    o.created_at,
    COALESCE(COUNT(uo.user_id), 0) AS member_count
  FROM public.organizations o
  LEFT JOIN public.user_organizations uo ON uo.org_id = o.id
  WHERE (o.is_discoverable IS NULL OR o.is_discoverable = true)
    AND o.name ILIKE '%' || TRIM(p_query) || '%'
  GROUP BY o.id, o.name, o.industry, o.size_category, o.logo_url, o.created_at
  ORDER BY 
    CASE WHEN LOWER(o.name) = LOWER(TRIM(p_query)) THEN 1
         WHEN LOWER(o.name) LIKE LOWER(TRIM(p_query)) || '%' THEN 2
         ELSE 3 END,
    o.name ASC
  LIMIT 12;
END;
$$;

-- Submit a join request
CREATE OR REPLACE FUNCTION public.submit_join_request(
  p_org_id uuid,
  p_job_title text DEFAULT NULL,
  p_department_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_user_full_name text;
  v_org_name text;
  v_existing_mem record;
  v_existing_req record;
  v_req_id uuid;
  v_res jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit join request.' USING ERRCODE = '42501';
  END IF;

  -- Verify target organization exists
  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target organization not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Check if user is already an active member of this organization
  SELECT role INTO v_existing_mem FROM public.user_organizations 
  WHERE org_id = p_org_id AND user_id = v_user_id;
  IF FOUND THEN
    RAISE EXCEPTION 'You are already an active member of %.', v_org_name USING ERRCODE = '23505';
  END IF;

  -- Ensure public.users profile exists
  SELECT email, full_name INTO v_user_email, v_user_full_name FROM public.users WHERE id = v_user_id;
  IF NOT FOUND THEN
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
    INTO v_user_email, v_user_full_name
    FROM auth.users
    WHERE id = v_user_id;

    INSERT INTO public.users (
      id, email, full_name, role, default_workspace_id, account_type, account_setup_completed, current_plan_tier, subscription_status
    ) VALUES (
      v_user_id, v_user_email, COALESCE(v_user_full_name, 'Team Member'), 'employee', NULL, 'organization', false, 'business_free', 'free'
    ) ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Check for existing pending request for this user and organization
  SELECT id, status, created_at INTO v_existing_req
  FROM public.organization_join_requests
  WHERE org_id = p_org_id AND user_id = v_user_id AND status = 'pending'
  LIMIT 1;

  IF FOUND THEN
    -- Return existing pending request gracefully without error
    SELECT jsonb_build_object(
      'success', true,
      'id', v_existing_req.id,
      'request_id', v_existing_req.id,
      'org_id', p_org_id,
      'org_name', v_org_name,
      'status', 'pending',
      'created_at', v_existing_req.created_at,
      'is_duplicate', true,
      'message', 'You already have a pending join request for this organization.'
    ) INTO v_res;
    RETURN v_res;
  END IF;

  -- Insert new join request
  INSERT INTO public.organization_join_requests (
    org_id, user_id, full_name, email, job_title, department_id, status
  ) VALUES (
    p_org_id,
    v_user_id,
    COALESCE(v_user_full_name, 'Applicant'),
    v_user_email,
    NULLIF(TRIM(p_job_title), ''),
    p_department_id,
    'pending'
  )
  RETURNING id INTO v_req_id;

  -- Update users account_type to 'organization', but keep account_setup_completed = false
  UPDATE public.users
  SET account_type = 'organization',
      account_setup_completed = false
  WHERE id = v_user_id;

  SELECT jsonb_build_object(
    'success', true,
    'id', v_req_id,
    'request_id', v_req_id,
    'org_id', p_org_id,
    'org_name', v_org_name,
    'status', 'pending',
    'created_at', now(),
    'is_duplicate', false,
    'message', 'Join request submitted successfully. Awaiting management review.'
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- Check current user's join request status
CREATE OR REPLACE FUNCTION public.get_user_join_request_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_req record;
  v_res jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('has_pending_request', false);
  END IF;

  SELECT 
    r.id,
    r.org_id,
    r.job_title,
    r.status,
    r.created_at,
    r.reviewed_at,
    r.review_notes,
    o.name AS org_name,
    o.logo_url AS org_logo_url,
    o.industry AS org_industry,
    o.size_category AS org_size_category
  INTO v_req
  FROM public.organization_join_requests r
  JOIN public.organizations o ON o.id = r.org_id
  WHERE r.user_id = v_user_id
  ORDER BY 
    CASE WHEN r.status = 'pending' THEN 1 ELSE 2 END,
    r.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_pending_request', false);
  END IF;

  SELECT jsonb_build_object(
    'has_pending_request', (v_req.status = 'pending'),
    'id', v_req.id,
    'request_id', v_req.id,
    'org_id', v_req.org_id,
    'org_name', v_req.org_name,
    'industry', v_req.org_industry,
    'size_category', v_req.org_size_category,
    'org_logo_url', v_req.org_logo_url,
    'org_industry', v_req.org_industry,
    'job_title', v_req.job_title,
    'status', v_req.status,
    'created_at', v_req.created_at,
    'reviewed_at', v_req.reviewed_at,
    'review_notes', v_req.review_notes
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- Cancel current user's pending request
CREATE OR REPLACE FUNCTION public.cancel_join_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.organization_join_requests
  SET status = 'cancelled'
  WHERE id = p_request_id AND user_id = v_user_id AND status = 'pending';

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Retrieve organization join requests for managers
CREATE OR REPLACE FUNCTION public.get_organization_join_requests(
  p_org_id uuid,
  p_status text DEFAULT 'pending'
)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  user_id uuid,
  full_name varchar,
  email varchar,
  job_title varchar,
  department_id uuid,
  department_name text,
  status varchar,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  assigned_role varchar,
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

  -- Verify caller is authorized manager/admin in this organization
  SELECT uo.role INTO v_caller_role
  FROM public.user_organizations uo
  WHERE uo.org_id = p_org_id AND uo.user_id = v_caller_id;

  IF v_caller_role IS NULL OR NOT (v_caller_role = ANY(ARRAY['owner', 'administrator', 'director', 'senior_manager', 'manager', 'managing_director', 'ceo', 'cto', 'hr']::varchar[])) THEN
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

-- Approve organization join request
CREATE OR REPLACE FUNCTION public.approve_organization_join_request(
  p_request_id uuid,
  p_assigned_role text DEFAULT 'employee',
  p_department_id uuid DEFAULT NULL,
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
  v_clean_role varchar;
  v_dept_id uuid;
  v_org_name text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Lock and fetch the request
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

  -- Prevent self-approval: A user must never be able to approve their own request
  IF v_req.user_id = v_caller_id THEN
    RAISE EXCEPTION 'Security violation: Users cannot approve their own join requests.' USING ERRCODE = '42501';
  END IF;

  -- Verify caller has management authority in this organization
  SELECT role INTO v_caller_role
  FROM public.user_organizations
  WHERE org_id = v_req.org_id AND user_id = v_caller_id;

  IF v_caller_role IS NULL OR NOT (v_caller_role = ANY(ARRAY['owner', 'administrator', 'director', 'senior_manager', 'manager', 'managing_director', 'ceo', 'cto', 'hr']::varchar[])) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to approve join requests.' USING ERRCODE = '42501';
  END IF;

  -- Normalize and validate assigned role against existing role system
  v_clean_role := COALESCE(NULLIF(TRIM(p_assigned_role), ''), 'employee');
  IF NOT (v_clean_role = ANY(ARRAY['administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'senior_employee', 'employee', 'intern', 'developer', 'general_member']::text[])) THEN
    RAISE EXCEPTION 'Invalid role assignment: %', v_clean_role USING ERRCODE = '22023';
  END IF;

  -- Only owners/CEOs can assign administrator roles
  IF v_clean_role IN ('owner', 'administrator') AND v_caller_role NOT IN ('owner', 'ceo', 'managing_director') THEN
    RAISE EXCEPTION 'Permission denied. Only organization owners can assign administrator roles.' USING ERRCODE = '42501';
  END IF;

  -- Validate department if provided
  v_dept_id := p_department_id;
  IF v_dept_id IS NOT NULL THEN
    PERFORM 1 FROM public.departments WHERE id = v_dept_id AND org_id = v_req.org_id AND is_deleted = false;
    IF NOT FOUND THEN
      v_dept_id := NULL;
    END IF;
  END IF;

  -- 1. Insert / Upsert into user_organizations
  INSERT INTO public.user_organizations (
    user_id, org_id, role, department_id, joined_at, invited_by
  ) VALUES (
    v_req.user_id,
    v_req.org_id,
    v_clean_role,
    v_dept_id,
    now(),
    v_caller_id
  )
  ON CONFLICT (user_id, org_id) DO UPDATE SET
    role = EXCLUDED.role,
    department_id = COALESCE(EXCLUDED.department_id, user_organizations.department_id);

  -- 2. Update users profile (grant access)
  UPDATE public.users
  SET account_type = 'organization',
      role = v_clean_role::public.user_role,
      default_workspace_id = v_req.org_id::text,
      department = (SELECT name FROM public.departments WHERE id = v_dept_id),
      account_setup_completed = true
  WHERE id = v_req.user_id;

  -- 3. Mark request as approved
  UPDATE public.organization_join_requests
  SET status = 'approved',
      reviewed_by = v_caller_id,
      reviewed_at = now(),
      assigned_role = v_clean_role,
      assigned_department_id = v_dept_id,
      review_notes = p_notes
  WHERE id = p_request_id;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_req.org_id;

  SELECT jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'user_id', v_req.user_id,
    'org_id', v_req.org_id,
    'org_name', v_org_name,
    'assigned_role', v_clean_role,
    'assigned_department_id', v_dept_id,
    'message', 'Member successfully approved and granted organization access.'
  ) INTO v_res;

  RETURN v_res;
END;
$$;

-- Reject organization join request
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

  IF v_caller_role IS NULL OR NOT (v_caller_role = ANY(ARRAY['owner', 'administrator', 'director', 'senior_manager', 'manager', 'managing_director', 'ceo', 'cto', 'hr']::varchar[])) THEN
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
