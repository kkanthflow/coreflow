-- ============================================================
-- CoreFlow Enterprise — Project Members Enhancement
-- Adds full audit tracking to project_members table
-- ============================================================

-- 1. Add audit columns to existing project_members table
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS assigned_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at  TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS removed_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notes        TEXT;

-- Migrate existing data: populate assigned_by from added_by if present
UPDATE public.project_members
  SET assigned_by = added_by,
      assigned_at = COALESCE(added_at, now())
  WHERE assigned_by IS NULL AND added_by IS NOT NULL;

-- 2. Add deleted_at column to projects if not present (for soft delete support)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id
  ON public.project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_is_active
  ON public.project_members(project_id, is_active);

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON public.projects(deleted_at) WHERE deleted_at IS NULL;

-- 4. RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated org members to view project members for projects in their org
DROP POLICY IF EXISTS "Org members can view project members" ON public.project_members;
CREATE POLICY "Org members can view project members"
  ON public.project_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.organization_id = p.org_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = auth.uid()
    )
  );

-- Allow users with assign_projects-equivalent roles to insert
DROP POLICY IF EXISTS "Managers can assign project members" ON public.project_members;
CREATE POLICY "Managers can assign project members"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.organization_id = p.org_id
      JOIN public.users u ON u.id = uo.user_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = auth.uid()
        AND u.role IN ('owner','administrator','director','senior_manager','manager')
    )
  );

-- Allow managers to update (remove/restore) members
DROP POLICY IF EXISTS "Managers can update project members" ON public.project_members;
CREATE POLICY "Managers can update project members"
  ON public.project_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.organization_id = p.org_id
      JOIN public.users u ON u.id = uo.user_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = auth.uid()
        AND u.role IN ('owner','administrator','director','senior_manager','manager')
    )
  );

-- 5. Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.project_members TO authenticated;

-- 6. Notify trigger: insert activity log on member assignment
CREATE OR REPLACE FUNCTION public.notify_project_member_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title TEXT;
BEGIN
  -- Only fire on new active assignments
  IF NEW.is_active = TRUE AND (OLD IS NULL OR OLD.is_active = FALSE) THEN
    SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;

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

    -- Insert activity log
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      COALESCE(NEW.assigned_by, NEW.user_id),
      'member_assigned',
      'project',
      NEW.project_id,
      jsonb_build_object(
        'assigned_user_id', NEW.user_id,
        'project_title', v_project_title
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_member_assigned ON public.project_members;
CREATE TRIGGER trg_project_member_assigned
  AFTER INSERT OR UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_member_assigned();
