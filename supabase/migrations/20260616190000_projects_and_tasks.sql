-- ============================================================
-- CoreFlow Enterprise — Phase 2: Projects & Tasks
-- ============================================================

-- 1. Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','review','completed','cancelled')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  owner_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_date     DATE,
  start_date   DATE,
  cover_color  TEXT DEFAULT '#1F6FEB',
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Project Members table
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','manager','member','viewer')),
  added_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  added_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- 3. Project Milestones table
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE,
  completed    BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done','blocked')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  assignee_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_date     DATE,
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  tags         TEXT[],
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 5. Task Comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 6. Task Activity table
CREATE TABLE IF NOT EXISTS public.task_activity (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action       TEXT NOT NULL, -- e.g., 'status_changed', 'assigned', 'commented', 'details_updated'
  old_value    TEXT,
  new_value    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_department_id ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON public.project_milestones(project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON public.tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON public.task_activity(task_id);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- RLS Policies
-- ────────────────────────────────────────────────────────────

-- PROJECTS
CREATE POLICY "Users can view projects in their org"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = projects.org_id
        AND user_id = (select auth.uid())::uuid
    )
  );

-- Include a project addition option that is restricted—only the user who assigns or owns the project can add it.
-- And only owner, administrator, director, senior_manager, manager can create/add projects generally (as per permissions table).
CREATE POLICY "Authorized roles can insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = projects.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
    ) AND (
      created_by = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Authorized roles can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = projects.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
    )
  );

CREATE POLICY "Authorized roles can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = projects.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );


-- PROJECT MEMBERS
CREATE POLICY "Users can view members of their project"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      JOIN public.projects p ON p.org_id = uo.org_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Managers can manage project members"
  ON public.project_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      JOIN public.projects p ON p.org_id = uo.org_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = (select auth.uid())::uuid
        AND uo.role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
    )
  );


-- MILESTONES
CREATE POLICY "Users can view milestones in their project"
  ON public.project_milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      WHERE p.id = project_milestones.project_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Managers can manage milestones"
  ON public.project_milestones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      WHERE p.id = project_milestones.project_id
        AND uo.user_id = (select auth.uid())::uuid
        AND uo.role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead')
    )
  );


-- TASKS
CREATE POLICY "Users can view tasks in their org"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = tasks.org_id
        AND user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Authorized roles can manage tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = tasks.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'senior_employee', 'employee')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = tasks.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'senior_employee', 'employee')
    )
  );


-- TASK COMMENTS
CREATE POLICY "Users can view comments of accessible tasks"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.user_organizations uo ON uo.org_id = t.org_id
      WHERE t.id = task_comments.task_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Users can post comments on accessible tasks"
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())::uuid
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.user_organizations uo ON uo.org_id = t.org_id
      WHERE t.id = task_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Users can edit/delete own comments"
  ON public.task_comments FOR UPDATE
  TO authenticated
  USING (author_id = (select auth.uid())::uuid);


-- TASK ACTIVITY
CREATE POLICY "Users can view activity of accessible tasks"
  ON public.task_activity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.user_organizations uo ON uo.org_id = t.org_id
      WHERE t.id = task_activity.task_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "System can log task activity"
  ON public.task_activity FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- ────────────────────────────────────────────────────────────
-- Triggers
-- ────────────────────────────────────────────────────────────

-- 1. Log Task Activity Trigger function
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := (select auth.uid())::uuid;
  
  -- If we can't determine who did it, default to the created_by/assignee or system account
  IF v_user_id IS NULL THEN
    v_user_id := COALESCE(new.assignee_id, new.created_by);
  END IF;

  IF v_user_id IS NULL THEN
    RETURN new;
  END IF;

  -- Log status change
  IF old.status IS DISTINCT FROM new.status THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (new.id, v_user_id, 'status_changed', old.status, new.status);
  END IF;

  -- Log assignee change
  IF old.assignee_id IS DISTINCT FROM new.assignee_id THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (
      new.id, 
      v_user_id, 
      'assignee_changed', 
      (SELECT email FROM public.users WHERE id = old.assignee_id), 
      (SELECT email FROM public.users WHERE id = new.assignee_id)
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_task_update
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.log_task_activity();

-- 2. Notify Assignee Trigger function
CREATE OR REPLACE FUNCTION public.notify_task_assignee()
RETURNS trigger AS $$
BEGIN
  -- Insert into notifications table
  IF new.assignee_id IS NOT NULL AND (old.assignee_id IS DISTINCT FROM new.assignee_id OR tg_op = 'INSERT') THEN
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
      new.assignee_id,
      'Task Assigned',
      'You have been assigned to task: ' || new.title,
      'task_assigned',
      false
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_task_assignee();

NOTIFY pgrst, 'reload schema';
