-- ============================================================
-- CoreFlow Enterprise — Project Access Control & Visibility Hardening
-- Migration: 20260828100000_project_access_hardening.sql
-- ============================================================

-- 1. Create project_client_access table for granular client project access
CREATE TABLE IF NOT EXISTS public.project_client_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  access_role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (access_role IN ('viewer', 'approver', 'collaborator')),
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_approve BOOLEAN NOT NULL DEFAULT true,
  can_request_changes BOOLEAN NOT NULL DEFAULT true,
  can_view_financials BOOLEAN NOT NULL DEFAULT false,
  can_view_receipts BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'revoked')),
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_project_client_user UNIQUE (project_id, user_id)
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_project_client_access_project ON public.project_client_access(project_id);
CREATE INDEX IF NOT EXISTS idx_project_client_access_user ON public.project_client_access(user_id);
CREATE INDEX IF NOT EXISTS idx_project_client_access_status ON public.project_client_access(status);
CREATE INDEX IF NOT EXISTS idx_project_members_user_project ON public.project_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_projects_department_id ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_user_org ON public.user_organizations(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_user_dept ON public.user_organizations(user_id, department_id);

-- 3. Enable RLS on project_client_access
ALTER TABLE public.project_client_access ENABLE ROW LEVEL SECURITY;

-- 4. Fix trigger notify_project_member_assigned to match activity_logs column schema (org_id, actor_id, old_value, new_value)
CREATE OR REPLACE FUNCTION public.notify_project_member_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title TEXT;
  v_org_id UUID;
BEGIN
  -- Only fire on new active assignments
  IF NEW.is_active = TRUE AND (OLD IS NULL OR OLD.is_active = FALSE) THEN
    SELECT title, org_id INTO v_project_title, v_org_id FROM public.projects WHERE id = NEW.project_id;

    -- Insert notification for the assigned user
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
    VALUES (
      NEW.user_id,
      'Added to Project',
      'You have been assigned to "' || COALESCE(v_project_title, 'a project') || '"',
      'project_assignment',
      NEW.project_id,
      'project',
      '/projects/' || NEW.project_id::TEXT,
      FALSE
    )
    ON CONFLICT DO NOTHING;

    -- Insert activity log if org_id is present
    IF v_org_id IS NOT NULL THEN
      INSERT INTO public.activity_logs (org_id, actor_id, action, entity_type, entity_id, new_value)
      VALUES (
        v_org_id,
        COALESCE(NEW.assigned_by, NEW.user_id),
        'member_assigned',
        'project',
        NEW.project_id,
        jsonb_build_object(
          'assigned_user_id', NEW.user_id,
          'project_title', v_project_title
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Backfill safety check: Ensure creator/owner of existing projects is a project_member
INSERT INTO public.project_members (project_id, user_id, role, is_active, added_at)
SELECT p.id, COALESCE(p.owner_id, p.created_by), 'owner', true, now()
FROM public.projects p
WHERE COALESCE(p.owner_id, p.created_by) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.project_members pm 
    WHERE pm.project_id = p.id AND pm.user_id = COALESCE(p.owner_id, p.created_by)
  )
ON CONFLICT (project_id, user_id) DO UPDATE SET is_active = true;

-- 5. Core PostgreSQL Authorization Functions (SECURITY DEFINER with strict search_path)

-- Helper: can_view_project
CREATE OR REPLACE FUNCTION public.can_view_project(p_user_id UUID, p_project_id UUID)
RETURNS BOOLEAN
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
  v_global_role VARCHAR(50);
  v_user_dept_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_project_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Lookup project details
  SELECT org_id, department_id, owner_id, created_by
  INTO v_org_id, v_dept_id, v_owner_id, v_created_by
  FROM public.projects
  WHERE id = p_project_id AND (deleted_at IS NULL);

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 2. Creator or designated project owner (Universal rule)
  IF v_owner_id = p_user_id OR v_created_by = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- 3. Project membership: Explicitly assigned member
  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id 
      AND pm.user_id = p_user_id 
      AND COALESCE(pm.is_active, true) = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- 4. Client Access (Direct client contact)
  IF EXISTS (
    SELECT 1 FROM public.project_client_access pca
    WHERE pca.project_id = p_project_id
      AND pca.user_id = p_user_id
      AND pca.status = 'active'
      AND pca.can_view = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- 5. Independent project (org_id IS NULL)
  IF v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 6. Organization project: Check user_organizations role
  SELECT role, department_id
  INTO v_user_role, v_user_dept_id
  FROM public.user_organizations
  WHERE org_id = v_org_id AND user_id = p_user_id;

  -- Also check global users.role if user_organizations is not populated
  IF v_user_role IS NULL THEN
    SELECT role INTO v_global_role FROM public.users WHERE id = p_user_id;
    IF v_global_role IN ('owner', 'admin', 'administrator', 'superadmin') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- 7. Organization OWNER / ADMIN has full visibility across all projects
  IF v_user_role IN ('owner', 'administrator', 'managing_director', 'ceo', 'cto') THEN
    RETURN TRUE;
  END IF;

  -- 8. Department-scoped access:
  IF v_user_role IN ('director', 'senior_manager', 'manager', 'project_manager') 
     AND v_dept_id IS NOT NULL 
     AND v_user_dept_id IS NOT NULL 
     AND v_dept_id = v_user_dept_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Helper: can_manage_project
CREATE OR REPLACE FUNCTION public.can_manage_project(p_user_id UUID, p_project_id UUID)
RETURNS BOOLEAN
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
  v_global_role VARCHAR(50);
  v_user_dept_id UUID;
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

  -- Creator or designated owner can always manage
  IF v_owner_id = p_user_id OR v_created_by = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Project Lead / Manager / Owner in project_members
  SELECT role INTO v_member_role
  FROM public.project_members
  WHERE project_id = p_project_id 
    AND user_id = p_user_id 
    AND COALESCE(is_active, true) = true;

  IF v_member_role IN ('owner', 'manager', 'lead') THEN
    RETURN TRUE;
  END IF;

  -- Independent project
  IF v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Organization role check
  SELECT role, department_id
  INTO v_user_role, v_user_dept_id
  FROM public.user_organizations
  WHERE org_id = v_org_id AND user_id = p_user_id;

  IF v_user_role IS NULL THEN
    SELECT role INTO v_global_role FROM public.users WHERE id = p_user_id;
    IF v_global_role IN ('owner', 'admin', 'administrator', 'superadmin') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Owner / Admin can manage all
  IF v_user_role IN ('owner', 'administrator', 'managing_director', 'ceo', 'cto') THEN
    RETURN TRUE;
  END IF;

  -- Department Head (Director / Senior Manager / Manager in matching department)
  IF v_user_role IN ('director', 'senior_manager', 'manager')
     AND v_dept_id IS NOT NULL 
     AND v_user_dept_id = v_dept_id THEN
    RETURN TRUE;
  END IF;

  -- Project Lead / Manager / Owner in project_members
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

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.can_view_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project(UUID, UUID) TO authenticated;

-- 6. Tighten RLS Policies on `projects`

DROP POLICY IF EXISTS "Users can view projects in their org" ON public.projects;
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;

CREATE POLICY "Users can view accessible projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.can_view_project(auth.uid(), id)
  );

DROP POLICY IF EXISTS "Authorized users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Authorized users can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      created_by = auth.uid()
      OR owner_id = auth.uid()
      OR org_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.org_id = projects.org_id
          AND uo.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Authorized roles can update projects" ON public.projects;
CREATE POLICY "Authorized roles can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    public.can_manage_project(auth.uid(), id)
  );

DROP POLICY IF EXISTS "Authorized roles can delete projects" ON public.projects;
CREATE POLICY "Authorized roles can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = projects.org_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'administrator', 'managing_director', 'ceo', 'cto')
    ) OR (
      projects.org_id IS NULL AND (projects.owner_id = auth.uid() OR projects.created_by = auth.uid())
    )
  );

-- 7. Update RLS Policies on Child Tables

-- PROJECT MEMBERS
DROP POLICY IF EXISTS "Org members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view members of their project" ON public.project_members;
DROP POLICY IF EXISTS "Users can view project members of accessible projects" ON public.project_members;

CREATE POLICY "Users can view project members of accessible projects"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    public.can_view_project(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "Managers can assign project members" ON public.project_members;
DROP POLICY IF EXISTS "Managers can manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Authorized users can insert project members" ON public.project_members;

CREATE POLICY "Authorized users can insert project members"
  ON public.project_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.can_manage_project(auth.uid(), project_id)
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND (p.created_by = auth.uid() OR p.owner_id = auth.uid())
    )
  );

CREATE POLICY "Managers can manage project members"
  ON public.project_members FOR ALL
  TO authenticated
  USING (
    public.can_manage_project(auth.uid(), project_id)
    OR user_id = auth.uid()
  );

-- PROJECT MILESTONES
DROP POLICY IF EXISTS "Users can view milestones in their project" ON public.project_milestones;
CREATE POLICY "Users can view milestones of accessible projects"
  ON public.project_milestones FOR SELECT
  TO authenticated
  USING (
    public.can_view_project(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "Managers can manage milestones" ON public.project_milestones;
CREATE POLICY "Authorized users can manage milestones"
  ON public.project_milestones FOR ALL
  TO authenticated
  USING (
    public.can_manage_project(auth.uid(), project_id)
  );

-- TASKS
DROP POLICY IF EXISTS "Users can view tasks in their org" ON public.tasks;
CREATE POLICY "Users can view tasks of accessible projects"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    (project_id IS NOT NULL AND public.can_view_project(auth.uid(), project_id))
    OR
    (project_id IS NULL AND (
      created_by = auth.uid() OR assignee_id = auth.uid()
      OR (org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.org_id = tasks.org_id AND uo.user_id = auth.uid() AND uo.role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
      ))
    ))
  );

DROP POLICY IF EXISTS "Authorized roles can manage tasks" ON public.tasks;
CREATE POLICY "Authorized roles can manage tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (
    assignee_id = auth.uid()
    OR created_by = auth.uid()
    OR (project_id IS NOT NULL AND public.can_manage_project(auth.uid(), project_id))
    OR (org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = tasks.org_id AND uo.user_id = auth.uid() AND uo.role IN ('owner', 'administrator')
    ))
  );

-- TASK COMMENTS
DROP POLICY IF EXISTS "Users can view comments of accessible tasks" ON public.task_comments;
CREATE POLICY "Users can view comments of accessible tasks"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id
        AND (
          (t.project_id IS NOT NULL AND public.can_view_project(auth.uid(), t.project_id))
          OR (t.project_id IS NULL AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid()))
        )
    )
  );

-- TASK ACTIVITY
DROP POLICY IF EXISTS "Users can view activity of accessible tasks" ON public.task_activity;
CREATE POLICY "Users can view activity of accessible tasks"
  ON public.task_activity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_activity.task_id
        AND (
          (t.project_id IS NOT NULL AND public.can_view_project(auth.uid(), t.project_id))
          OR (t.project_id IS NULL AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid()))
        )
    )
  );

-- PROJECT CLIENT ACCESS POLICIES
DROP POLICY IF EXISTS "Users can view client access for their projects" ON public.project_client_access;
CREATE POLICY "Users can view client access for their projects"
  ON public.project_client_access FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR public.can_view_project(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "Managers can manage client access" ON public.project_client_access;
CREATE POLICY "Managers can manage client access"
  ON public.project_client_access FOR ALL
  TO authenticated
  USING (
    public.can_manage_project(auth.uid(), project_id)
  );

-- 8. Turn on Realtime publication for project_client_access if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_client_access'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_client_access;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
