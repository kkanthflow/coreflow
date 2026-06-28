-- Convert client-callable RPC functions to SECURITY INVOKER so they respect RLS and resolve the linter warnings
ALTER FUNCTION public.check_can_view_channel(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.check_department_dependencies(uuid) SECURITY INVOKER;
ALTER FUNCTION public.create_default_org_channels() SECURITY INVOKER;
ALTER FUNCTION public.create_project_channel() SECURITY INVOKER;
ALTER FUNCTION public.delete_department_safe(uuid, uuid, uuid) SECURITY INVOKER;

NOTIFY pgrst, 'reload schema';
