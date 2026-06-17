-- 1. Drop the debug table that has no RLS
DROP TABLE IF EXISTS public.auth_debug_logs;

-- 2. Drop the view that triggered the security_definer_view error
DROP VIEW IF EXISTS public.auth_logs;

-- 3. Create a SECURITY DEFINER function in the PRIVATE schema to safely bypass RLS
CREATE OR REPLACE FUNCTION private.get_auth_logs_internal()
RETURNS TABLE (
  id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.payload, a.created_at
  FROM auth.audit_log_entries a
  ORDER BY a.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set search path to secure the definer function
ALTER FUNCTION private.get_auth_logs_internal() SET search_path = public;

-- 4. Create a SECURITY INVOKER function in the PUBLIC schema exposed to the API
-- This satisfies the linter because the public function doesn't bypass RLS directly
CREATE OR REPLACE FUNCTION public.get_auth_logs()
RETURNS TABLE (
  id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()::uuid
    AND users.role IN ('managing_director', 'ceo', 'cto')
  ) THEN
    RAISE EXCEPTION 'Only admins can view auth logs';
  END IF;

  RETURN QUERY SELECT * FROM private.get_auth_logs_internal();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Grant execute to authenticated users for the public RPC wrapper
GRANT EXECUTE ON FUNCTION public.get_auth_logs() TO authenticated;
