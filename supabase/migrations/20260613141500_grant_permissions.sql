GRANT ALL ON public.organizations TO anon, authenticated, service_role;
GRANT ALL ON public.user_organizations TO anon, authenticated, service_role;

-- Also update the organizations SELECT policy to allow anyone to select by name for registration purposes,
-- or just allow public reading of organization names (since we need to check if they exist).
-- If we only allow viewing orgs they belong to, then a new user CANNOT check if an org exists!
DROP POLICY IF EXISTS "Users can view orgs they belong to" ON organizations;

CREATE POLICY "Anyone can view organizations"
  ON organizations FOR SELECT
  USING (true);
