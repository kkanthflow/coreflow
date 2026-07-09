-- Create a function to allow users to securely delete their own accounts

CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void AS $$
BEGIN
  -- Delete the user from auth.users (which cascades to public.users and all related data)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply search path security guidelines
ALTER FUNCTION public.delete_own_user() SET search_path = public, pg_temp;

-- Revoke execute from public/anonymous, grant to authenticated users only
REVOKE EXECUTE ON FUNCTION public.delete_own_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_user() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
