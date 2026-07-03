-- Create the function in the private schema with SECURITY DEFINER
CREATE OR REPLACE FUNCTION private.check_can_view_channel(channel_uuid UUID, user_uuid UUID)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Safely drop the old function from the public schema if it exists
DROP FUNCTION IF EXISTS public.check_can_view_channel(uuid, uuid);

-- Recreate SELECT policy on chat_channels using the private schema function with optimized auth.uid()
DROP POLICY IF EXISTS "Users can view channels they belong to" ON public.chat_channels;
CREATE POLICY "Users can view channels they belong to"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (
    created_by = (select auth.uid())::uuid
    OR private.check_can_view_channel(id, (select auth.uid())::uuid)
  );

-- Recreate SELECT policy on channel_members using the private schema function with optimized auth.uid()
DROP POLICY IF EXISTS "Users can see channel members" ON public.channel_members;
CREATE POLICY "Users can see channel members" ON public.channel_members
  FOR SELECT TO authenticated
  USING (
    private.check_can_view_channel(channel_id, (select auth.uid())::uuid)
  );

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
