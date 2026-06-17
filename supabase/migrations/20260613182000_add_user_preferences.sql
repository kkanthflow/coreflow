-- Create user_preferences table to store app and notification settings
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  theme VARCHAR(20) DEFAULT 'light',
  haptic_feedback BOOLEAN DEFAULT TRUE,
  biometric_login BOOLEAN DEFAULT FALSE,
  meeting_invites BOOLEAN DEFAULT TRUE,
  meeting_reminders BOOLEAN DEFAULT TRUE,
  role_updates BOOLEAN DEFAULT TRUE,
  system_alerts BOOLEAN DEFAULT FALSE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view their own preferences" 
  ON public.user_preferences FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
  ON public.user_preferences FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
  ON public.user_preferences FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Update handle_new_user function to automatically create user preferences
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
  
  -- Automatically insert default preferences for the new user
  BEGIN
    INSERT INTO public.user_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Prevent trigger failure if preferences insert fails
    NULL;
  END;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;
