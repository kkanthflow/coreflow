-- Set the search_path explicitly on the new public wrapper function to satisfy the linter
ALTER FUNCTION public.get_auth_logs() SET search_path = public;
