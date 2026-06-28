-- Allow all organization members to create channels under their organization
DROP POLICY IF EXISTS "Authorized members can create channels" ON public.chat_channels;
CREATE POLICY "Authorized members can create channels"
  ON public.chat_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = chat_channels.org_id
        AND user_id = (select auth.uid())::uuid
    )
  );

-- Recreate SELECT policy to explicitly allow the creator to select the channel (crucial during INSERT RETURNING)
DROP POLICY IF EXISTS "Users can view channels they belong to" ON public.chat_channels;
CREATE POLICY "Users can view channels they belong to"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (
    created_by = (select auth.uid())::uuid
    OR public.check_can_view_channel(id, auth.uid()::uuid)
  );

NOTIFY pgrst, 'reload schema';
