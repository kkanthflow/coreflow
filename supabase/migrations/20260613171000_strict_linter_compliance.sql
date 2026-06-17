-- Create a private schema for internal RLS helper functions
CREATE SCHEMA IF NOT EXISTS private;

-- Grant usage so authenticated users can execute policies that reference private functions
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- 1. Move check_is_attendee to private schema
ALTER FUNCTION public.check_is_attendee(uuid, uuid) SET SCHEMA private;

-- Update the RLS policies on meetings to use the private schema function
DROP POLICY IF EXISTS "Users can view meetings" ON public.meetings;
CREATE POLICY "Users can view meetings"
ON public.meetings FOR SELECT
USING (
  creator_id = auth.uid()::uuid OR 
  private.check_is_attendee(id, auth.uid()::uuid)
);

-- Update the RLS policies on meeting_attendees to use the private schema function
DROP POLICY IF EXISTS "Users can see attendees of their meetings" ON public.meeting_attendees;
CREATE POLICY "Users can see attendees of their meetings"
ON public.meeting_attendees FOR SELECT
USING (
  user_id = auth.uid()::uuid OR
  private.check_is_attendee(meeting_id, auth.uid()::uuid)
);

-- 2. Move is_org_member to private schema
ALTER FUNCTION public.is_org_member(uuid) SET SCHEMA private;

-- Update the RLS policies on user_organizations to use the private schema function
DROP POLICY IF EXISTS "Users can see other members in their orgs" ON public.user_organizations;
CREATE POLICY "Users can see other members in their orgs"
  ON public.user_organizations FOR SELECT
  USING (
    user_id = auth.uid()::uuid OR private.is_org_member(org_id)
  );

DROP POLICY IF EXISTS "Users can join an org or be added" ON public.user_organizations;
CREATE POLICY "Users can join an org or be added"
  ON public.user_organizations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid OR private.is_org_member(org_id)
  );

-- 3. Replace get_auth_logs function with a secure View to avoid function execute warnings
DROP FUNCTION IF EXISTS public.get_auth_logs();

CREATE OR REPLACE VIEW public.auth_logs AS
SELECT id, payload, created_at
FROM auth.audit_log_entries
WHERE EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid()::uuid
  AND role IN ('managing_director', 'ceo', 'cto')
);

-- Grant select on the view to authenticated users
GRANT SELECT ON public.auth_logs TO authenticated;
