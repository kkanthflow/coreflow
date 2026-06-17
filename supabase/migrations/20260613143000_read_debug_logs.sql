CREATE OR REPLACE FUNCTION public.get_auth_logs()
RETURNS text AS $$
DECLARE
  res text;
BEGIN
  SELECT string_agg(err_msg || ' - ' || COALESCE(err_detail, ''), ' | ') INTO res FROM public.auth_debug_logs;
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
