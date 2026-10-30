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
  p_title               TEXT,
  p_description         TEXT       DEFAULT NULL,
  p_priority            TEXT       DEFAULT 'medium',
  p_cover_color         TEXT       DEFAULT '#1F6FEB',
  p_status              TEXT       DEFAULT 'active',
  p_due_date            TEXT       DEFAULT NULL,
  p_department_id       TEXT       DEFAULT NULL,
  p_org_id              TEXT       DEFAULT NULL,
  p_project_type        TEXT       DEFAULT 'standard',
  p_workflow_stage      TEXT       DEFAULT 'planning',
  p_department_metadata JSONB      DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));
  v_department_id UUID;
  v_org_id UUID;
  v_due_date DATE;
  v_project_id UUID;
  v_result JSONB;
BEGIN
  IF p_department_id IS NOT NULL AND p_department_id <> '' THEN
    v_department_id := p_department_id::UUID;
  END IF;

  IF p_org_id IS NOT NULL AND p_org_id <> '' THEN
    v_org_id := p_org_id::UUID;
  END IF;

  IF p_due_date IS NOT NULL AND p_due_date <> '' THEN
    v_due_date := p_due_date::DATE;
  END IF;

  INSERT INTO public.projects (
    org_id,
    department_id,
    title,
    description,
    priority,
    cover_color,
    status,
    due_date,
    project_type,
    workflow_stage,
    department_metadata,
    owner_id,
    created_by
  ) VALUES (
    v_org_id,
    v_department_id,
    p_title,
    p_description,
    p_priority,
    p_cover_color,
    p_status,
    v_due_date,
    COALESCE(p_project_type, 'standard'),
    COALESCE(p_workflow_stage, 'planning'),
    COALESCE(p_department_metadata, '{}'::jsonb),
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_project_id;

  INSERT INTO public.project_members (project_id, user_id, role, added_by)
  VALUES (v_project_id, v_user_id, 'owner', v_user_id)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner';

  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'status', p.status,
    'project_type', p.project_type,
    'workflow_stage', p.workflow_stage,
    'department_id', p.department_id,
    'org_id', p.org_id
  ) INTO v_result
  FROM public.projects p
  WHERE p.id = v_project_id;

  RETURN v_result;
END;
$$;

-- Grant execution
GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_department_project(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, anon, service_role;

-- ------------------------------------------------------------------------------
-- 7. TRIGGER: AUTO-INITIALIZE DEPARTMENTS FOR NEW ORGANIZATIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.init_new_org_departments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Software Development
  INSERT INTO public.departments (
    org_id, name, description, purpose, color, status, is_deleted, module_configurations
  ) VALUES (
    NEW.id, 'Software Development', 'Engineering, platform architecture, and sprint delivery.',
    'Deliver high-velocity reliable software systems and feature releases.', '#FF6B4A', 'active', false,
    jsonb_build_object(
      'project_configuration', jsonb_build_object(
        'project_types', jsonb_build_array('Software Product', 'Sprint Release', 'Bug Resolution Workstream', 'Architecture Refactor'),
        'workflow_stages', jsonb_build_array('Backlog', 'Sprint Planning', 'In Development', 'Code Review', 'QA Testing', 'Released'),
        'metrics', jsonb_build_array('Velocity', 'Deliverables', 'Milestones')
      )
    )
  );

  -- Sales & Marketing
  INSERT INTO public.departments (
    org_id, name, description, purpose, color, status, is_deleted, module_configurations
  ) VALUES (
    NEW.id, 'Sales & Marketing', 'Campaigns, lead acquisition, brand growth, and client relationships.',
    'Expand market presence, acquire target customers, and manage outward deliverables.', '#60A5FA', 'active', false,
    jsonb_build_object(
      'project_configuration', jsonb_build_object(
        'project_types', jsonb_build_array('Marketing Campaign', 'Content Deliverable', 'Product Launch', 'Lead Gen Initiative'),
        'workflow_stages', jsonb_build_array('Campaign Strategy', 'Content Drafting', 'Creative Review', 'Live in Market', 'Performance Review'),
        'metrics', jsonb_build_array('Conversion', 'Reach', 'Deliverables')
      )
    )
  );

  -- Finance & Operations
  INSERT INTO public.departments (
    org_id, name, description, purpose, color, status, is_deleted, module_configurations
  ) VALUES (
    NEW.id, 'Finance & Operations', 'Fiscal governance, budget allocation, audits, and operational health.',
    'Maintain financial integrity, fiscal accuracy, and corporate compliance.', '#34D399', 'active', false,
    jsonb_build_object(
      'project_configuration', jsonb_build_object(
        'project_types', jsonb_build_array('Budget Planning', 'Audit & Compliance', 'Quarterly Reconciliation', 'Expense Optimization'),
        'workflow_stages', jsonb_build_array('Proposed', 'Budget Allocation', 'Fiscal Approval', 'Execution', 'Audited & Reconciled'),
        'metrics', jsonb_build_array('Budget Variance', 'Compliance Rate', 'Milestones')
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_new_org_departments ON public.organizations;
CREATE TRIGGER trg_init_new_org_departments
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.init_new_org_departments();
