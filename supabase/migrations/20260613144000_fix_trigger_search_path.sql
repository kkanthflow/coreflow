CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role public.user_role;
  v_role_str text;
BEGIN
  v_role_str := new.raw_user_meta_data->>'role';
  
  -- Try to safely cast the role
  BEGIN
    IF v_role_str IS NOT NULL AND v_role_str != '' THEN
      v_role := v_role_str::public.user_role;
    ELSE
      v_role := 'general_member'::public.user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'general_member'::public.user_role;
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
  END;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
