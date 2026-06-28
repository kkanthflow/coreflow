-- ============================================================
-- CoreFlow Enterprise Department Soft Delete & Audit Trail
-- ============================================================

-- Add soft-delete fields
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_departments_is_deleted ON public.departments(is_deleted);

-- Update RLS SELECT policy to exclude deleted departments
DROP POLICY IF EXISTS "Org members can view departments" ON public.departments;
CREATE POLICY "Org members can view departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (
    is_deleted = false AND
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = departments.org_id
        AND user_id = (select auth.uid())::uuid
    )
  );

-- Update RLS UPDATE policy to exclude deleted departments
DROP POLICY IF EXISTS "Admins can update departments" ON public.departments;
CREATE POLICY "Admins can update departments"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (
    is_deleted = false AND
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = departments.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

-- Function to check department dependencies
CREATE OR REPLACE FUNCTION public.check_department_dependencies(dept_id UUID)
RETURNS TABLE (
  employees_count INT,
  projects_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM public.user_organizations WHERE department_id = dept_id) AS employees_count,
    (SELECT COUNT(*)::INT FROM public.projects WHERE department_id = dept_id) AS projects_count;
END;
$$;

-- Function to safely soft-delete a department with reassignment
CREATE OR REPLACE FUNCTION public.delete_department_safe(
  dept_id UUID,
  transfer_user_dept_id UUID DEFAULT NULL,
  transfer_project_dept_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dept_name TEXT;
  dept_org_id UUID;
  caller_uid UUID;
  caller_role TEXT;
  has_delete_permission BOOLEAN;
  deps_employees INT;
  deps_projects INT;
  old_config JSONB;
  new_config JSONB;
BEGIN
  -- Get caller UID
  caller_uid := auth.uid()::uuid;
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get department information
  SELECT name, org_id, jsonb_build_object('name', name, 'description', description, 'color', color, 'head_user_id', head_user_id)
  INTO dept_name, dept_org_id, old_config
  FROM public.departments
  WHERE id = dept_id AND is_deleted = false;

  IF dept_name IS NULL THEN
    RAISE EXCEPTION 'Department not found or already deleted';
  END IF;

  -- Get caller role in organization
  SELECT role INTO caller_role
  FROM public.user_organizations
  WHERE org_id = dept_org_id AND user_id = caller_uid;

  -- Check if caller has permission
  -- Only Owner, Administrator (Super Admin equivalent), or explicit department.delete
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE org_id = dept_org_id AND user_id = caller_uid AND permission = 'department.delete'
  ) INTO has_delete_permission;

  IF caller_role NOT IN ('owner', 'administrator') AND NOT has_delete_permission THEN
    RAISE EXCEPTION 'Unauthorized: Only Organization Owners, Admins, or users with department.delete permission can delete departments';
  END IF;

  -- Get dependencies
  SELECT employees_count, projects_count INTO deps_employees, deps_projects
  FROM public.check_department_dependencies(dept_id);

  -- Validate dependencies & transfer options
  IF deps_employees > 0 AND transfer_user_dept_id IS NULL THEN
    RAISE EXCEPTION 'Cannot delete: Department has assigned employees. Please specify a transfer department.';
  END IF;

  IF deps_projects > 0 AND transfer_project_dept_id IS NULL THEN
    RAISE EXCEPTION 'Cannot delete: Department has associated projects. Please specify a transfer department.';
  END IF;

  -- Validate transfer department exists and belongs to same org
  IF transfer_user_dept_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = transfer_user_dept_id AND org_id = dept_org_id AND is_deleted = false) THEN
      RAISE EXCEPTION 'Invalid transfer department for employees';
    END IF;
  END IF;

  IF transfer_project_dept_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = transfer_project_dept_id AND org_id = dept_org_id AND is_deleted = false) THEN
      RAISE EXCEPTION 'Invalid transfer department for projects';
    END IF;
  END IF;

  -- Perform transfers
  IF deps_employees > 0 AND transfer_user_dept_id IS NOT NULL THEN
    UPDATE public.user_organizations
    SET department_id = transfer_user_dept_id
    WHERE department_id = dept_id;
  END IF;

  IF deps_projects > 0 AND transfer_project_dept_id IS NOT NULL THEN
    UPDATE public.projects
    SET department_id = transfer_project_dept_id
    WHERE department_id = dept_id;
  END IF;

  -- Soft delete
  UPDATE public.departments
  SET is_deleted = true,
      deleted_at = now()
  WHERE id = dept_id;

  -- Log Audit Trail
  new_config := jsonb_build_object(
    'is_deleted', true,
    'transfer_user_dept_id', transfer_user_dept_id,
    'transfer_project_dept_id', transfer_project_dept_id
  );

  INSERT INTO public.activity_logs (
    org_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  ) VALUES (
    dept_org_id,
    caller_uid,
    'department_deleted',
    'department',
    dept_id,
    old_config,
    new_config
  );

  RETURN TRUE;
END;
$$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
