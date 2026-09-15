-- ============================================================
-- CoreFlow Enterprise — Create Project RPC (bypasses client RLS)
-- Migration: 20260828110000_create_project_rpc.sql
-- ============================================================

-- Atomically creates a project and adds the caller as the owner member.
-- Runs as SECURITY DEFINER so the caller doesn't need INSERT permission
-- on both projects and project_members simultaneously from the client.

CREATE OR REPLACE FUNCTION public.create_project_with_member(
  p_title        TEXT,
  p_description  TEXT       DEFAULT NULL,
  p_priority     TEXT       DEFAULT 'medium',
  p_cover_color  TEXT       DEFAULT '#1F6FEB',
  p_status       TEXT       DEFAULT 'active',
  p_due_date     DATE       DEFAULT NULL,
  p_department_id UUID      DEFAULT NULL,
  p_org_id       UUID       DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_project_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Resolve the calling user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Authorization: user must belong to the org (if org-scoped)
  IF p_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = p_org_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'You are not a member of this organization';
    END IF;
  END IF;

  -- 3. Insert the project
  INSERT INTO public.projects (
    title, description, priority, cover_color, status,
    owner_id, created_by, due_date, department_id, org_id
  ) VALUES (
    p_title, p_description, p_priority, p_cover_color, p_status,
    v_user_id, v_user_id, p_due_date, p_department_id, p_org_id
  )
  RETURNING id INTO v_project_id;

  -- 4. Add creator as project owner member
  INSERT INTO public.project_members (project_id, user_id, role, is_active, added_by)
  VALUES (v_project_id, v_user_id, 'owner', true, v_user_id)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'owner', is_active = true;

  -- 5. Return the created project as JSON
  SELECT jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'description', p.description,
    'priority', p.priority,
    'cover_color', p.cover_color,
    'status', p.status,
    'owner_id', p.owner_id,
    'created_by', p.created_by,
    'due_date', p.due_date,
    'department_id', p.department_id,
    'org_id', p.org_id,
    'created_at', p.created_at
  ) INTO v_result
  FROM public.projects p
  WHERE p.id = v_project_id;

  RETURN v_result;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_project_with_member(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
