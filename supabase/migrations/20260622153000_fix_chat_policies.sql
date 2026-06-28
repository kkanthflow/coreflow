-- Fix infinite recursion in chat_channels and channel_members policies

-- 1. Create a SECURITY DEFINER function to check channel access without RLS recursion
CREATE OR REPLACE FUNCTION public.check_can_view_channel(channel_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_id UUID;
  v_project_id UUID;
  v_type TEXT;
  v_created_by UUID;
BEGIN
  -- Get channel details using public.chat_channels (bypassing RLS because SECURITY DEFINER)
  SELECT org_id, project_id, type, created_by INTO v_org_id, v_project_id, v_type, v_created_by
  FROM public.chat_channels
  WHERE id = channel_uuid;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 1. Org-wide channels: visible to non-freelancers of the organization
  IF v_project_id IS NULL AND v_type IN ('org_general', 'org_announcement') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = v_org_id
        AND user_id = user_uuid
        AND role != 'freelancer'
    );
  END IF;

  -- 2. Project channels: visible to project members (including freelancers)
  IF v_project_id IS NOT NULL AND v_type = 'project' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = v_project_id
        AND user_id = user_uuid
    );
  END IF;

  -- 3. Private channels and DMs: visible only to explicit channel members OR the creator
  RETURN (
    v_created_by = user_uuid
    OR EXISTS (
      SELECT 1 FROM public.channel_members
      WHERE channel_id = channel_uuid AND user_id = user_uuid
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.check_can_view_channel(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_can_view_channel(UUID, UUID) TO service_role;

-- 3. Recreate policies on chat_channels
DROP POLICY IF EXISTS "Users can view channels they belong to" ON public.chat_channels;
CREATE POLICY "Users can view channels they belong to"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (
    public.check_can_view_channel(id, auth.uid()::uuid)
  );

-- 4. Recreate policies on channel_members
DROP POLICY IF EXISTS "Users can see channel members" ON public.channel_members;
CREATE POLICY "Users can see channel members"
  ON public.channel_members FOR SELECT
  TO authenticated
  USING (
    public.check_can_view_channel(channel_id, auth.uid()::uuid)
  );

-- 5. Force reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
