-- Add UPDATE policy for user_organizations to allow department assignment by administrators/managers

DROP POLICY IF EXISTS "Org admins can update user memberships" ON public.user_organizations;

CREATE POLICY "Org admins can update user memberships"
  ON public.user_organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.user_id = auth.uid()
        AND uo.org_id = user_organizations.org_id
        AND uo.role IN ('owner', 'administrator', 'managing_director', 'ceo', 'director', 'senior_manager', 'manager')
    )
  );

NOTIFY pgrst, 'reload schema';
