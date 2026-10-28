-- ==============================================================================
-- AUVRYN — Remove Auto-Generated Departments Migration
-- Migration: 20261028010000_remove_auto_generated_departments.sql
--
-- Actions:
-- 1. Create a safety backup table of all auto-seeded departments.
-- 2. Delete auto-generated / seeded department records across all organizations
--    while strictly preserving ANY user-created department data (e.g., 'Finance Department')
--    and protecting any department referenced by members, projects, meetings or join requests.
-- 3. Update project access logic (can_view_project) so that users without a department
--    (including Department Heads in orgs without departments) are never blocked from access.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SAFETY BACKUP OF SEEDED DEPARTMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._backup_auto_seeded_departments AS
SELECT * FROM public.departments
WHERE name = ANY(ARRAY[
  'Executive Leadership', 'Software Engineering & Development', 'Cybersecurity & Information Security',
  'DevOps, Cloud & Infrastructure', 'Quality Assurance & Testing', 'Product Management & Design',
  'Data, Analytics & Artificial Intelligence', 'Project & Program Management', 'Finance & Accounting',
  'Human Resources & People Operations', 'Sales & Business Development', 'Marketing & Communications',
  'Customer Support & Professional Services', 'Legal, Compliance & Risk', 'Administration & Internal IT',
  'Research & Development', 'Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'Operations', 'General'
])
AND id NOT IN (SELECT department_id FROM public.user_organizations WHERE department_id IS NOT NULL)
AND id NOT IN (SELECT department_id FROM public.projects WHERE department_id IS NOT NULL)
AND id NOT IN (SELECT team_id FROM public.meetings WHERE team_id IS NOT NULL)
AND id NOT IN (SELECT department_id FROM public.organization_join_requests WHERE department_id IS NOT NULL)
AND id NOT IN (SELECT assigned_department_id FROM public.organization_join_requests WHERE assigned_department_id IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 2. DELETE UNREFERENCED AUTO-GENERATED / SEEDED DEPARTMENTS
-- ------------------------------------------------------------------------------
DELETE FROM public.departments
WHERE name = ANY(ARRAY[
  'Executive Leadership', 'Software Engineering & Development', 'Cybersecurity & Information Security',
  'DevOps, Cloud & Infrastructure', 'Quality Assurance & Testing', 'Product Management & Design',
  'Data, Analytics & Artificial Intelligence', 'Project & Program Management', 'Finance & Accounting',
  'Human Resources & People Operations', 'Sales & Business Development', 'Marketing & Communications',
  'Customer Support & Professional Services', 'Legal, Compliance & Risk', 'Administration & Internal IT',
  'Research & Development', 'Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'Operations', 'General'
])
AND id NOT IN (SELECT department_id FROM public.user_organizations WHERE department_id IS NOT NULL)
AND id NOT IN (SELECT department_id FROM public.projects WHERE department_id IS NOT NULL)
AND id NOT IN (SELECT team_id FROM public.meetings WHERE team_id IS NOT NULL)
AND id NOT IN (SELECT department_id FROM public.organization_join_requests WHERE department_id IS NOT NULL)
AND id NOT IN (SELECT assigned_department_id FROM public.organization_join_requests WHERE assigned_department_id IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 3. ENSURE can_view_project DOES NOT REQUIRE DEPARTMENTS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_project(p_user_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_owner_id uuid;
  v_created_by uuid;
  v_user_role text;
  v_user_dept_id uuid;
  v_custom_role_id uuid;
  v_scope_projects text := 'organization';
BEGIN
  IF p_user_id IS NULL OR p_project_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT org_id, department_id, owner_id, created_by
  INTO v_org_id, v_dept_id, v_owner_id, v_created_by
  FROM public.projects
  WHERE id = p_project_id AND (deleted_at IS NULL);

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 1. Designated project owner or creator
  IF v_owner_id = p_user_id OR v_created_by = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- 2. Explicitly assigned project member
  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id 
      AND pm.user_id = p_user_id 
      AND COALESCE(pm.is_active, true) = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Client direct contact with active authorized access
  IF EXISTS (
    SELECT 1 FROM public.project_client_access pca
    WHERE pca.project_id = p_project_id
      AND pca.user_id = p_user_id
      AND pca.status = 'active'
      AND pca.can_view = true
  ) THEN
    RETURN TRUE;
  END IF;

  IF v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 4. Organization primary owner has full visibility
  IF EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = v_org_id AND o.owner_id = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- 5. Check user's organization membership and role
  SELECT role, department_id, custom_role_id
  INTO v_user_role, v_user_dept_id, v_custom_role_id
  FROM public.user_organizations
  WHERE org_id = v_org_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_user_role IN ('client', 'guest') THEN
    RETURN FALSE;
  END IF;

  -- 6. Check custom role scope limits if assigned
  IF v_custom_role_id IS NOT NULL THEN
    SELECT COALESCE(scope_limits->>'projects', 'organization') INTO v_scope_projects
    FROM public.organization_roles
    WHERE id = v_custom_role_id AND org_id = v_org_id AND is_active = true;

    IF v_scope_projects = 'project' OR v_scope_projects = 'assigned' THEN
      RETURN FALSE;
    END IF;

    IF v_scope_projects = 'department' THEN
      IF v_dept_id IS NOT NULL AND v_user_dept_id IS NOT NULL AND v_dept_id = v_user_dept_id THEN
        RETURN public.has_org_permission(p_user_id, v_org_id, 'projects.view');
      END IF;
      IF v_user_dept_id IS NULL OR v_dept_id IS NULL THEN
        RETURN public.has_org_permission(p_user_id, v_org_id, 'projects.view');
      END IF;
      RETURN FALSE;
    END IF;
  END IF;

  -- 7. Built-in Department Head scope restriction
  IF v_user_role = 'department_head' THEN
    IF v_dept_id IS NOT NULL AND v_user_dept_id IS NOT NULL AND v_dept_id = v_user_dept_id THEN
      RETURN TRUE;
    END IF;
    IF v_user_dept_id IS NULL OR v_dept_id IS NULL THEN
      RETURN public.has_org_permission(p_user_id, v_org_id, 'projects.view');
    END IF;
    RETURN FALSE;
  END IF;

  -- 8. General permission check for projects.view
  RETURN public.has_org_permission(p_user_id, v_org_id, 'projects.view');
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated;
