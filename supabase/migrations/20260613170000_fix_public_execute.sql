-- Fix anon warnings by revoking from PUBLIC
REVOKE EXECUTE ON FUNCTION public.check_is_attendee(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.check_is_attendee(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon;

-- Grant to authenticated so they can still use them via RLS or directly
GRANT EXECUTE ON FUNCTION public.check_is_attendee(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
