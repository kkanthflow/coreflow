-- ============================================================
-- CoreFlow Enterprise Foundation — Phase 1
-- New role hierarchy, departments, extended profiles, PBAC
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1: Extend the user_role enum with new hierarchy values
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrator';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'director';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senior_manager';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'team_lead';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senior_employee';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'intern';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ────────────────────────────────────────────────────────────
-- STEP 2: Migrate existing users to new role hierarchy
-- ────────────────────────────────────────────────────────────
-- managing_director / ceo / cto → owner (they created the org)
UPDATE public.users
SET role = 'owner'
WHERE role IN ('managing_director', 'ceo', 'cto');

-- hr → administrator
UPDATE public.users
SET role = 'administrator'
WHERE role = 'hr';

-- project_manager → manager
UPDATE public.users
SET role = 'manager'
WHERE role = 'project_manager';

-- developer / general_member → employee
UPDATE public.users
SET role = 'employee'
WHERE role IN ('developer', 'general_member');

-- freelancer stays freelancer

-- Also migrate user_organizations.role column
UPDATE public.user_organizations
SET role = 'owner'
WHERE role IN ('managing_director', 'ceo', 'cto');

UPDATE public.user_organizations
SET role = 'administrator'
WHERE role = 'hr';

UPDATE public.user_organizations
SET role = 'manager'
WHERE role = 'project_manager';

UPDATE public.user_organizations
SET role = 'employee'
WHERE role IN ('developer', 'general_member');

-- ────────────────────────────────────────────────────────────
-- STEP 3: Extend users table with enterprise profile fields
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- ────────────────────────────────────────────────────────────
-- STEP 4: Extend organizations table
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS size_category TEXT DEFAULT 'small'
    CHECK (size_category IN ('solo','small','medium','large','enterprise')),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ────────────────────────────────────────────────────────────
-- STEP 5: Extend user_organizations
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_organizations
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- STEP 6: Create departments table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6B7280',
  head_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON public.departments(org_id);

-- RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Members of the org can view departments
CREATE POLICY IF NOT EXISTS "Org members can view departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = departments.org_id
        AND user_id = (select auth.uid())::uuid
    )
  );

-- Only owner/administrator can create departments
CREATE POLICY IF NOT EXISTS "Admins can create departments"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = departments.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

-- Only owner/administrator can update departments
CREATE POLICY IF NOT EXISTS "Admins can update departments"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = departments.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

-- ────────────────────────────────────────────────────────────
-- STEP 7: Create role_permissions table (custom permission overrides)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_user ON public.role_permissions(user_id, org_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Owners can manage custom permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = role_permissions.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

CREATE POLICY IF NOT EXISTS "Users can view own permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

-- ────────────────────────────────────────────────────────────
-- STEP 8: Supabase Storage — avatars bucket
-- (Run separately in Storage dashboard if this fails)
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY IF NOT EXISTS "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY IF NOT EXISTS "Anyone can view avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- ────────────────────────────────────────────────────────────
-- STEP 9: Seed default departments for existing orgs
-- ────────────────────────────────────────────────────────────
INSERT INTO public.departments (org_id, name, color)
SELECT DISTINCT id, 'General', '#1F6FEB' FROM public.organizations
ON CONFLICT (org_id, name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- STEP 10: Notify PostgREST to reload schema
-- ────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

SELECT 
  'Phase 1 migration complete' AS status,
  (SELECT COUNT(*) FROM public.users WHERE role = 'owner') AS owners,
  (SELECT COUNT(*) FROM public.users WHERE role = 'administrator') AS admins,
  (SELECT COUNT(*) FROM public.users WHERE role = 'employee') AS employees,
  (SELECT COUNT(*) FROM public.users WHERE role = 'freelancer') AS freelancers,
  (SELECT COUNT(*) FROM public.departments) AS departments;
