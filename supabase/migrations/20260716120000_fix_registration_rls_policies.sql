-- Migration to fix RLS policy constraints that block registration and joining organizations

-- 1. Table: public.user_organizations (Allow insertion during registration)
DROP POLICY IF EXISTS "Users can join an org or be added" ON public.user_organizations;
CREATE POLICY "Users can join an org or be added" ON public.user_organizations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid 
    OR 
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = org_id AND uo.user_id = auth.uid()::uuid AND uo.role IN ('owner', 'admin')
    )
  );

-- 2. Table: public.workspaces (Allow users to create their own workspaces)
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
CREATE POLICY "Users can create workspaces" ON public.workspaces
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()::uuid
  );

-- 3. Table: public.workspace_members (Allow users to join workspace or be added by owner)
DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;
CREATE POLICY "Users can join workspaces" ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid
    OR
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()::uuid
    )
  );

-- 4. Table: public.freelancer_profiles (Allow users to insert/update their freelancer profile)
DROP POLICY IF EXISTS "Users can manage their own freelancer profile" ON public.freelancer_profiles;
CREATE POLICY "Users can manage their own freelancer profile" ON public.freelancer_profiles
  FOR ALL
  USING (id = auth.uid()::uuid)
  WITH CHECK (id = auth.uid()::uuid);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
