-- 1. Fix "Function Search Path Mutable" (WARN)
-- Functions executed with SECURITY DEFINER should have search_path set explicitly to prevent search path hijacking.
ALTER FUNCTION public.create_user_with_role(varchar, varchar, user_role) SET search_path = public;
ALTER FUNCTION public.soft_delete_user(uuid) SET search_path = public;
ALTER FUNCTION public.get_auth_logs() SET search_path = public;
ALTER FUNCTION public.change_user_role(uuid, user_role, text) SET search_path = public;
ALTER FUNCTION public.cleanup_test_accounts() SET search_path = public;
ALTER FUNCTION public.get_user_upcoming_meetings(uuid, integer) SET search_path = public;
ALTER FUNCTION public.is_org_member(uuid) SET search_path = public;
ALTER FUNCTION public.check_is_attendee(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 2. Fix "Public Can Execute SECURITY DEFINER Function" (WARN)
-- Prevent unauthenticated (anon) users from executing these sensitive functions via the REST API.
REVOKE EXECUTE ON FUNCTION public.check_is_attendee(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_user_with_role(varchar, varchar, user_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.change_user_role(uuid, user_role, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_test_accounts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_upcoming_meetings(uuid, integer) FROM anon;

-- Also revoke handle_new_user from authenticated and public since it's only meant to be called by the auth trigger
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

-- 3. Fix "RLS Policy Always True" (WARN)
-- The notifications table had an overly permissive INSERT policy (WITH CHECK (true)).
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;

CREATE POLICY "Users can create notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());
