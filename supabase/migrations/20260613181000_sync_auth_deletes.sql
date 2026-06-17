-- Clean up existing orphaned users that do not exist in auth.users
DELETE FROM public.users WHERE id NOT IN (SELECT id FROM auth.users);

CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.users WHERE id = old.id;
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_deleted_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_deleted_user() TO supabase_auth_admin, service_role;


-- Trigger to call the function when a user is deleted from Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_deleted_user();
