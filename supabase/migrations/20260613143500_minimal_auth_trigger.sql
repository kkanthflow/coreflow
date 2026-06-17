CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (new.id, new.email, 'Test User');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
