-- Helper function in private schema to bypass RLS recursion
CREATE OR REPLACE FUNCTION private.is_channel_member(channel_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_id = channel_uuid AND user_id = auth.uid()::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution
GRANT EXECUTE ON FUNCTION private.is_channel_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_channel_member(UUID) TO service_role;

-- Recreate policies on chat_channels
DROP POLICY IF EXISTS "Users can view channels they belong to" ON public.chat_channels;
CREATE POLICY "Users can view channels they belong to"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (
    (project_id IS NULL AND type IN ('org_general', 'org_announcement') AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = chat_channels.org_id
        AND user_id = (select auth.uid())::uuid
        AND role != 'freelancer'
    ))
    OR (project_id IS NOT NULL AND type = 'project' AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = chat_channels.project_id
        AND user_id = (select auth.uid())::uuid
    ))
    OR private.is_channel_member(id)
  );

-- Recreate policies on channel_members
DROP POLICY IF EXISTS "Users can see channel members" ON public.channel_members;
CREATE POLICY "Users can see channel members"
  ON public.channel_members FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())::uuid OR private.is_channel_member(channel_id)
  );

NOTIFY pgrst, 'reload schema';
