-- Fix: Allow authenticated users to search organizations by name
-- This is required for the "Join an existing organization" flow in register.tsx
-- Previously, RLS only allowed viewing orgs the user already belonged to,
-- which made it impossible to search for an org to join.

DROP POLICY IF EXISTS "Users can view orgs they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Any authenticated user can create an org" ON public.organizations;

-- Any authenticated user can view/search all organizations
-- (needed to find an org by name before joining it)
CREATE POLICY "Authenticated users can view all organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can create an org
CREATE POLICY "Any authenticated user can create an org"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
