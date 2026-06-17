-- Migration: Allow anon and authenticated users to read and insert organizations
-- This fixes the issue where registering users cannot search/join or create organizations because they are not yet authenticated.

-- 1. Redefine SELECT policy to allow anyone (anon and authenticated) to view organizations
DROP POLICY IF EXISTS "Authenticated users can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view orgs they belong to" ON public.organizations;

CREATE POLICY "Anyone can view all organizations"
  ON public.organizations FOR SELECT
  USING (true);

-- 2. Redefine INSERT policy to allow anyone (anon and authenticated) to create an organization
DROP POLICY IF EXISTS "Any authenticated user can create an org" ON public.organizations;

CREATE POLICY "Anyone can create an org"
  ON public.organizations FOR INSERT
  WITH CHECK (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
