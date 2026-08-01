-- Fix recursive policy for user_organizations insert
DROP POLICY IF EXISTS "Users can join an org or be added" ON public.user_organizations;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE org_id = org_uuid AND user_id = auth.uid()::uuid AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can join an org or be added" ON public.user_organizations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid 
    OR 
    public.is_org_admin(org_id)
  );

NOTIFY pgrst, 'reload schema';
