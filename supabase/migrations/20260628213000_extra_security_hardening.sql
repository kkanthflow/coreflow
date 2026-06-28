-- 1. Fix RLS Always True on organizations (replace true with auth.uid() check)
DROP POLICY IF EXISTS "Anyone can create an org" ON public.organizations;
CREATE POLICY "Anyone can create an org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Fix Public Bucket Allows Listing on avatars bucket
-- Public buckets in Supabase allow public URL access without any SELECT policies.
-- Removing the SELECT policy prevents listing files in the bucket via the API.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- 3. Explicitly Revoke EXECUTE from anon and authenticated for system/trigger functions
-- These functions are internal and should never be callable by users or anonymous clients.
ALTER FUNCTION public.on_new_chat_message() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.on_new_chat_message() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.on_new_chat_message() TO service_role;

ALTER FUNCTION public.trg_trim_organization_name() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.trg_trim_organization_name() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_trim_organization_name() TO service_role;

ALTER FUNCTION public.notify_task_assignee() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.notify_task_assignee() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_task_assignee() TO service_role;

ALTER FUNCTION public.notify_project_member_assigned() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.notify_project_member_assigned() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_project_member_assigned() TO service_role;

ALTER FUNCTION public.log_task_activity() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.log_task_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_task_activity() TO service_role;

-- 4. Explicitly Revoke EXECUTE from anon for user-callable RPC functions (allow authenticated)
ALTER FUNCTION public.check_can_view_channel(uuid, uuid) SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.check_can_view_channel(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_can_view_channel(uuid, uuid) TO authenticated, service_role;

ALTER FUNCTION public.check_department_dependencies(uuid) SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.check_department_dependencies(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_department_dependencies(uuid) TO authenticated, service_role;

ALTER FUNCTION public.create_default_org_channels() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.create_default_org_channels() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_default_org_channels() TO authenticated, service_role;

ALTER FUNCTION public.create_project_channel() SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.create_project_channel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_channel() TO authenticated, service_role;

ALTER FUNCTION public.delete_department_safe(uuid, uuid, uuid) SECURITY DEFINER;
REVOKE EXECUTE ON FUNCTION public.delete_department_safe(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_department_safe(uuid, uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
