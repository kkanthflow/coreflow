-- Restore default PUBLIC execute permission for the trigger function
-- Trigger functions cannot be executed manually anyway, and Supabase Auth requires this to work properly.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;
