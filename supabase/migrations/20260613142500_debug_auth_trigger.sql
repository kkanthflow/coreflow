CREATE TABLE IF NOT EXISTS public.auth_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  err_msg TEXT,
  err_detail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role user_role;
  v_role_str text;
  v_err_msg text;
  v_err_detail text;
BEGIN
  v_role_str := new.raw_user_meta_data->>'role';
  
  -- Try to safely cast the role
  BEGIN
    IF v_role_str IS NOT NULL AND v_role_str != '' THEN
      v_role := v_role_str::user_role;
    ELSE
      v_role := 'general_member'::user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'general_member'::user_role;
  END;

  -- Insert user or update if exists
  BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
      new.id, 
      new.email, 
      COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      v_role
    );
  EXCEPTION WHEN unique_violation THEN
    -- If email exists, update the user with the new auth ID
    UPDATE public.users 
    SET id = new.id, 
        full_name = COALESCE(new.raw_user_meta_data->>'full_name', public.users.full_name),
        role = v_role
    WHERE email = new.email;
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT, v_err_detail = PG_EXCEPTION_DETAIL;
    INSERT INTO public.auth_debug_logs (err_msg, err_detail) VALUES (v_err_msg, v_err_detail);
    -- We can still return new to let auth succeed even if public.users fails!
  END;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
