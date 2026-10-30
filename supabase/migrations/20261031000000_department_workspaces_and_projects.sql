-- ==============================================================================
-- AUVRYN — Department-Specific Workspaces, Project Architecture & Leadership Visibility
-- Migration: 20261031000000_department_workspaces_and_projects.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND PROJECTS TABLE WITH DEPARTMENT-SPECIFIC COLUMNS
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
  -- 1.1 Project Type (e.g. 'Software Project', 'Marketing Campaign', 'Financial Initiative', 'Recruitment Drive')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'project_type'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN project_type text NOT NULL DEFAULT 'standard';
  END IF;

  -- 1.2 Department Metadata (Custom fields, department-specific KPIs, deliverables, sprint/budget attributes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'department_metadata'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN department_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  -- 1.3 Department Workflow Stage (e.g. 'Backlog', 'Sprint', 'QA', 'In Market', 'Budgeting', 'Reconciliation')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'workflow_stage'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN workflow_stage text NOT NULL DEFAULT 'planning';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_dept_id ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_dept ON public.projects(org_id, department_id);
CREATE INDEX IF NOT EXISTS idx_projects_workflow_stage ON public.projects(department_id, workflow_stage);

-- ------------------------------------------------------------------------------
-- 2. INITIALIZE PROJECT CONFIGURATIONS ON EXISTING DEPARTMENTS
-- ------------------------------------------------------------------------------
UPDATE public.departments
SET module_configurations = jsonb_set(
  COALESCE(module_configurations, '{}'::jsonb),
  '{project_configuration}',
  jsonb_build_object(
    'project_types', CASE 
      WHEN name ILIKE '%software%' OR name ILIKE '%engineer%' OR name ILIKE '%tech%' THEN 
        jsonb_build_array('Software Product', 'Sprint Release', 'Bug Resolution Workstream', 'Architecture Refactor')
      WHEN name ILIKE '%market%' OR name ILIKE '%growth%' OR name ILIKE '%sales%' THEN 
        jsonb_build_array('Marketing Campaign', 'Content Deliverable', 'Product Launch', 'Lead Gen Initiative')
      WHEN name ILIKE '%finance%' OR name ILIKE '%account%' THEN 
        jsonb_build_array('Budget Planning', 'Audit & Compliance', 'Quarterly Reconciliation', 'Expense Optimization')
      WHEN name ILIKE '%hr%' OR name ILIKE '%people%' OR name ILIKE '%talent%' THEN 
        jsonb_build_array('Recruitment Drive', 'Onboarding Wave', 'Employee Training', 'Performance Review')
      ELSE 
        jsonb_build_array('Operational Workstream', 'Strategic Initiative', 'Standard Project')
    END,
    'workflow_stages', CASE 
      WHEN name ILIKE '%software%' OR name ILIKE '%engineer%' OR name ILIKE '%tech%' THEN 
        jsonb_build_array('Backlog', 'Sprint Planning', 'In Development', 'Code Review', 'QA Testing', 'Released')
      WHEN name ILIKE '%market%' OR name ILIKE '%growth%' OR name ILIKE '%sales%' THEN 
        jsonb_build_array('Campaign Strategy', 'Content Drafting', 'Creative Review', 'Live in Market', 'Performance Review')
      WHEN name ILIKE '%finance%' OR name ILIKE '%account%' THEN 
        jsonb_build_array('Proposed', 'Budget Allocation', 'Fiscal Approval', 'Execution', 'Audited & Reconciled')
      WHEN name ILIKE '%hr%' OR name ILIKE '%people%' OR name ILIKE '%talent%' THEN 
        jsonb_build_array('Job Spec Draft', 'Candidate Sourcing', 'Interview Pipeline', 'Offer & Onboarding', 'Hired')
      ELSE 
        jsonb_build_array('Planning', 'In Progress', 'Under Review', 'Completed')
    END,
    'metrics', jsonb_build_array('Progress Velocity', 'Deliverable Count', 'Stage Milestones')
  )
)
WHERE module_configurations->'project_configuration' IS NULL;

-- ------------------------------------------------------------------------------
-- 3. DATA MIGRATION: SAFELY BACKFILL LEGACY PROJECTS WITH DEPARTMENT_ID
-- ------------------------------------------------------------------------------
-- Preserve all existing project records, IDs, and tasks.
-- If a project's department_id is null, link it to the organization's primary active department.
DO $$
DECLARE
  r RECORD;
  v_default_dept_id uuid;
BEGIN
  FOR r IN SELECT DISTINCT org_id FROM public.projects WHERE department_id IS NULL AND org_id IS NOT NULL LOOP
    -- Prefer a software/development department if title hints at dev, or the first active department
    SELECT id INTO v_default_dept_id 
    FROM public.departments 
    WHERE org_id = r.org_id AND is_deleted = false 
    ORDER BY 
      CASE WHEN name ILIKE '%software%' OR name ILIKE '%product%' THEN 0 ELSE 1 END,
      created_at ASC 
    LIMIT 1;

    IF v_default_dept_id IS NOT NULL THEN
      UPDATE public.projects 
      SET department_id = v_default_dept_id 
      WHERE org_id = r.org_id AND department_id IS NULL;
    END IF;
  END LOOP;

  -- Also synchronize tasks with project's department_id where task department_id is null
  UPDATE public.tasks t
  SET department_id = p.department_id
  FROM public.projects p
  WHERE t.project_id = p.id 
    AND t.department_id IS NULL 
    AND p.department_id IS NOT NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 4. RLS & ACCESS ENFORCEMENT: can_view_project
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_project(p_user_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_proj_dept_id uuid;
  v_owner_id uuid;
  v_created_by uuid;
  v_user_role text;
  v_leadership_vis text;
BEGIN
  IF p_user_id IS NULL OR p_project_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Fetch project metadata
  SELECT org_id, department_id, owner_id, created_by
  INTO v_org_id, v_proj_dept_id, v_owner_id, v_created_by
  FROM public.projects 
  WHERE id = p_project_id AND (deleted_at IS NULL);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 2. Solo / Indie Project: Owner or Creator
  IF v_org_id IS NULL THEN
    RETURN (v_owner_id = p_user_id OR v_created_by = p_user_id);
  END IF;

  -- 3. Project Owner or Creator always has direct access
  IF v_owner_id = p_user_id OR v_created_by = p_user_id THEN
    RETURN true;
  END IF;

  -- 4. Organization Owner Bypass (Multiple Owners Supported)
  IF public.is_org_owner(p_user_id, v_org_id) THEN
    RETURN true;
  END IF;

  -- 5. Leadership Oversight Check
  -- Only leadership members with full_organization or all_departments visibility can see across departments
  SELECT visibility_level INTO v_leadership_vis
  FROM public.leadership_members
  WHERE org_id = v_org_id AND user_id = p_user_id AND is_active = true;

  IF v_leadership_vis IN ('full_organization', 'all_departments') THEN
    RETURN true;
  END IF;

  -- Also support explicit administrator role in user_organizations
  SELECT role INTO v_user_role
  FROM public.user_organizations
  WHERE org_id = v_org_id AND user_id = p_user_id;

  IF v_user_role IN ('owner', 'administrator') THEN
    RETURN true;
  END IF;

  -- 6. Explicitly Assigned Project Member (Cross-Department Collaboration)
  -- Allows members from another department to participate in this project without opening the entire department
  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id 
      AND pm.user_id = p_user_id 
      AND COALESCE(pm.is_active, true) = true
  ) THEN
    RETURN true;
  END IF;

  -- 7. Client Portal Direct Access
  IF EXISTS (
    SELECT 1 FROM public.project_client_access pca
    WHERE pca.project_id = p_project_id
      AND pca.user_id = p_user_id
      AND pca.status = 'active'
      AND pca.can_view = true
  ) THEN
    RETURN true;
  END IF;

  -- 8. Department Isolation Check:
  -- If project belongs to a department, user MUST be an enrolled member of that department
  IF v_proj_dept_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.department_members dm
      WHERE dm.department_id = v_proj_dept_id AND dm.user_id = p_user_id
    ) OR EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = v_org_id AND uo.user_id = p_user_id AND uo.department_id = v_proj_dept_id
    ) THEN
      RETURN true;
    END IF;
    
    -- If user is NOT in this department and NOT an assigned project member, DENY access
    RETURN false;
  END IF;

  -- 9. Fallback for unassigned org projects
  RETURN public.has_org_permission(p_user_id, v_org_id, 'projects.view');
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RLS & ACCESS ENFORCEMENT: can_manage_project
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_project(p_user_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_proj_dept_id uuid;
  v_owner_id uuid;
  v_created_by uuid;
  v_user_role text;
  v_leadership_vis text;
  v_member_role text;
  v_dept_role text;
BEGIN
  IF p_user_id IS NULL OR p_project_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT org_id, department_id, owner_id, created_by
  INTO v_org_id, v_proj_dept_id, v_owner_id, v_created_by
  FROM public.projects 
  WHERE id = p_project_id AND (deleted_at IS NULL);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1. Project Owner / Creator
  IF v_owner_id = p_user_id OR v_created_by = p_user_id THEN
    RETURN true;
  END IF;

  -- 2. Organization Owner Bypass
  IF v_org_id IS NOT NULL AND public.is_org_owner(p_user_id, v_org_id) THEN
    RETURN true;
  END IF;

  -- 3. Leadership with management authority
  SELECT visibility_level INTO v_leadership_vis
  FROM public.leadership_members
  WHERE org_id = v_org_id AND user_id = p_user_id AND is_active = true;

  IF v_leadership_vis IN ('full_organization', 'all_departments') THEN
    RETURN true;
  END IF;

  SELECT role INTO v_user_role
  FROM public.user_organizations
  WHERE org_id = v_org_id AND user_id = p_user_id;

  IF v_user_role IN ('owner', 'administrator') THEN
    RETURN true;
  END IF;

  -- 4. Department Head or Lead of the project's department
  IF v_proj_dept_id IS NOT NULL THEN
    SELECT department_role INTO v_dept_role
    FROM public.department_members
    WHERE department_id = v_proj_dept_id AND user_id = p_user_id;

    IF v_dept_role IN ('head', 'lead') THEN
      RETURN true;
    END IF;
  END IF;

  -- 5. Project Lead / Manager role in project_members
  SELECT role INTO v_member_role
  FROM public.project_members
  WHERE project_id = p_project_id 
    AND user_id = p_user_id 
    AND COALESCE(is_active, true) = true;

  IF v_member_role IN ('owner', 'manager', 'lead') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC: CREATE DEPARTMENT-SPECIFIC PROJECT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_department_project(
  p_org_id uuid,
  p_department_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_project_type text DEFAULT 'standard',
  p_workflow_stage text DEFAULT 'planning',
  p_priority text DEFAULT 'medium',
  p_due_date date DEFAULT NULL,
  p_cover_color text DEFAULT '#1F6FEB',
  p_department_metadata jsonb DEFAULT '{}'::jsonb,
  p_initial_member_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_can_create boolean := false;
  v_dept_role text;
  v_new_project_id uuid;
  v_member_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify authorization to create project in this department
  IF public.is_org_owner(v_caller_id, p_org_id) THEN
    v_can_create := true;
  ELSE
    SELECT department_role INTO v_dept_role
    FROM public.department_members
    WHERE department_id = p_department_id AND user_id = v_caller_id;

    IF v_dept_role IN ('head', 'lead', 'member') THEN
      v_can_create := true;
    ELSIF public.has_org_permission(v_caller_id, p_org_id, 'projects.create') THEN
      v_can_create := true;
    END IF;
  END IF;

  IF NOT v_can_create THEN
    RAISE EXCEPTION 'Unauthorized to create projects in this department';
  END IF;

  -- Insert project
  INSERT INTO public.projects (
    org_id,
    department_id,
    title,
    description,
    project_type,
    workflow_stage,
    status,
    priority,
    due_date,
    cover_color,
    department_metadata,
    owner_id,
    created_by
  ) VALUES (
    p_org_id,
    p_department_id,
    p_title,
    p_description,
    p_project_type,
    p_workflow_stage,
    CASE 
      WHEN p_workflow_stage ILIKE '%complete%' OR p_workflow_stage ILIKE '%release%' THEN 'completed'
      WHEN p_workflow_stage ILIKE '%progress%' OR p_workflow_stage ILIKE '%dev%' OR p_workflow_stage ILIKE '%market%' THEN 'active'
      ELSE 'planning'
    END,
    p_priority,
    p_due_date,
    p_cover_color,
    p_department_metadata,
    v_caller_id,
    v_caller_id
  )
  RETURNING id INTO v_new_project_id;

  -- Add creator as owner in project_members
  INSERT INTO public.project_members (project_id, user_id, role, added_by)
  VALUES (v_new_project_id, v_caller_id, 'owner', v_caller_id)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

  -- Add initial members
  IF p_initial_member_ids IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY p_initial_member_ids LOOP
      IF v_member_id <> v_caller_id THEN
        INSERT INTO public.project_members (project_id, user_id, role, added_by)
        VALUES (v_new_project_id, v_member_id, 'member', v_caller_id)
        ON CONFLICT (project_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'project_id', v_new_project_id
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_department_project(uuid, uuid, text, text, text, text, text, date, text, jsonb, uuid[]) TO authenticated, service_role;
