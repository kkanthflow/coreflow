-- ============================================================
-- CoreFlow Enterprise — Phase 4: File Management + Audit Logs
-- ============================================================

-- 1. Files table
CREATE TABLE IF NOT EXISTS public.files (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id     UUID REFERENCES public.projects(id) ON DELETE CASCADE, -- NULL = organization wide file
  uploader_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  bucket         TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  file_size      BIGINT,
  mime_type      TEXT,
  version        INTEGER DEFAULT 1,
  parent_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL, -- for version tracking
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 2. Activity logs table (append-only)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,  -- e.g. 'role_changed', 'project_created', 'task_created', etc.
  entity_type  TEXT NOT NULL,  -- e.g. 'user', 'project', 'task', 'invoice', 'file'
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 3. Extend notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_org ON public.files(org_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON public.files(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON public.activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- RLS Policies
-- ────────────────────────────────────────────────────────────

-- FILES RLS
DROP POLICY IF EXISTS "Users can view org files" ON public.files;
CREATE POLICY "Users can view org files"
  ON public.files FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = (select auth.uid())::uuid
    )
    AND (
      -- Freelancer check: only allow files for projects they are assigned to
      (SELECT role FROM public.user_organizations WHERE user_id = (select auth.uid())::uuid LIMIT 1) != 'freelancer'
      OR (project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = files.project_id AND user_id = (select auth.uid())::uuid
      ))
    )
  );

DROP POLICY IF EXISTS "Users can upload files" ON public.files;
CREATE POLICY "Users can upload files"
  ON public.files FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = (select auth.uid())::uuid
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = files.project_id AND user_id = (select auth.uid())::uuid
      )
    )
  );

-- ACTIVITY LOGS RLS (Append-only: Inserts allowed, Select restricted to Admin/Owner, no Updates/Deletes)
DROP POLICY IF EXISTS "Users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = (select auth.uid())::uuid
  );

DROP POLICY IF EXISTS "Owners and admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Owners and admins can view activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = activity_logs.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
