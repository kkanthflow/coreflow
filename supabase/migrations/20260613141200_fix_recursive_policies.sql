-- Drop recursive policies
DROP POLICY IF EXISTS "Users can see other members in their orgs" ON user_organizations;
DROP POLICY IF EXISTS "Users can join an org or be added" ON user_organizations;

-- Users can see other members in their orgs (using a security definer function to avoid recursion)
-- Alternatively, we can just allow viewing all user_organizations if the user is authenticated, 
-- or use a subquery that bypasses RLS if needed. 
-- For simplicity, since user_organizations only links user IDs to org IDs, we can allow viewing if authenticated
-- BUT to be secure, let's just create a non-recursive policy.

-- Create a helper function to bypass RLS for checking org membership
CREATE OR REPLACE FUNCTION public.is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE org_id = org_uuid AND user_id = auth.uid()::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policies using the helper function
CREATE POLICY "Users can see other members in their orgs"
  ON user_organizations FOR SELECT
  USING (
    user_id = auth.uid()::uuid OR public.is_org_member(org_id)
  );

CREATE POLICY "Users can join an org or be added"
  ON user_organizations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid OR public.is_org_member(org_id)
  );
