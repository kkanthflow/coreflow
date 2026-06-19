-- Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_name ON organizations(name);

-- Create user_organizations table for many-to-many relationship
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member', -- e.g., 'owner', 'admin', 'member'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, org_id)
);

CREATE INDEX idx_user_orgs_user_id ON user_organizations(user_id);
CREATE INDEX idx_user_orgs_org_id ON user_organizations(org_id);

-- Alter users table so it can link to auth.users
-- Change default from gen_random_uuid to not having a default, so we can insert auth.users.id
-- But existing records have it, so we leave it, just make sure it references auth.users
-- Since this is local dev and we might not have auth.users setup yet for old data, we'll just allow it

-- Function to handle new user signups from Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a user is created in Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Organizations
CREATE POLICY "Users can view orgs they belong to"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE org_id = organizations.id AND user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Any authenticated user can create an org"
  ON organizations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their own org memberships"
  ON user_organizations FOR SELECT
  USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can see other members in their orgs"
  ON user_organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.org_id = user_organizations.org_id AND uo.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can join an org or be added"
  ON user_organizations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid OR
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.org_id = org_id AND uo.user_id = auth.uid()::uuid AND uo.role IN ('owner', 'admin')
    )
  );
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'freelancer';
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'general_member'::user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Drop recursive policies
DROP POLICY IF EXISTS "Users can see other members in their orgs" ON user_organizations;
DROP POLICY IF EXISTS "Users can join an org or be added" ON user_organizations;

-- Users can see other members in their orgs (using a security definer function to avoid recursion)
-- Alternatively, we can just allow viewing all user_organizations if the user is authenticated, 
-- or use a subquery that bypasses RLS if needed. 
-- For simplicity, since user_organizations only links user IDs to org IDs, we can allow viewing if authenticated
-- BUT to be secure, let's just create a non-recursive policy.

-- Create a helper function to bypass RLS for checking org membership
CREATE OR REPLACE FUNCTION public.is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE org_id = org_uuid AND user_id = auth.uid()::uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policies using the helper function
CREATE POLICY "Users can see other members in their orgs"
  ON user_organizations FOR SELECT
  USING (
    user_id = auth.uid()::uuid OR public.is_org_member(org_id)
  );

CREATE POLICY "Users can join an org or be added"
  ON user_organizations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid OR public.is_org_member(org_id)
  );
GRANT ALL ON public.organizations TO anon, authenticated, service_role;
GRANT ALL ON public.user_organizations TO anon, authenticated, service_role;

-- Also update the organizations SELECT policy to allow anyone to select by name for registration purposes,
-- or just allow public reading of organization names (since we need to check if they exist).
-- If we only allow viewing orgs they belong to, then a new user CANNOT check if an org exists!
DROP POLICY IF EXISTS "Users can view orgs they belong to" ON organizations;

CREATE POLICY "Anyone can view organizations"
  ON organizations FOR SELECT
  USING (true);
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role user_role;
  v_role_str text;
BEGIN
  v_role_str := new.raw_user_meta_data->>'role';
  
  -- Try to safely cast the role
  BEGIN
    IF v_role_str IS NOT NULL AND v_role_str != '' THEN
      v_role := v_role_str::user_role;
    ELSE
      v_role := 'general_member'::user_role;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
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
  END;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
CREATE OR REPLACE FUNCTION public.get_auth_logs()
RETURNS text AS $$
DECLARE
  res text;
BEGIN
  SELECT string_agg(err_msg || ' - ' || COALESCE(err_detail, ''), ' | ') INTO res FROM public.auth_debug_logs;
  RETURN res;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (new.id, new.email, 'Test User');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
-- Add missing INSERT policies for notifications and activity_feed

-- Anyone can create a notification (e.g. for meeting invites)
CREATE POLICY "Users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

-- Users can log their own activity
CREATE POLICY "Users can create activity feed"
  ON activity_feed FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);
-- Grant permissions to access all tables in the public schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- To ensure future tables also get these grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
-- Fix infinite recursion in meetings and meeting_attendees policies

-- 1. Drop the existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view meeting attendees" ON meeting_attendees;
DROP POLICY IF EXISTS "Users can view invited meetings" ON meetings;

-- 2. Create a SECURITY DEFINER function to safely check if a user is an attendee
-- This bypasses RLS and prevents the infinite recursion loop
CREATE OR REPLACE FUNCTION public.check_is_attendee(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.meeting_attendees 
    WHERE meeting_id = p_meeting_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the meetings policy using the secure function
CREATE POLICY "Users can view invited meetings"
  ON meetings FOR SELECT
  USING (
    public.check_is_attendee(id, auth.uid()::uuid)
  );

-- 4. Recreate the meeting_attendees policy using the secure function
CREATE POLICY "Users can view meeting attendees"
  ON meeting_attendees FOR SELECT
  USING (
    user_id = auth.uid()::uuid -- Can view own attendance
    OR 
    EXISTS ( -- Can view attendees of meetings they created
      SELECT 1 FROM meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = auth.uid()::uuid
    )
    OR
    public.check_is_attendee(meeting_id, auth.uid()::uuid) -- Can view attendees of meetings they are invited to
  );
-- 1. Fix "Function Search Path Mutable" (WARN)
-- Functions executed with SECURITY DEFINER should have search_path set explicitly to prevent search path hijacking.
ALTER FUNCTION public.create_user_with_role(varchar, varchar, user_role) SET search_path = public;
ALTER FUNCTION public.soft_delete_user(uuid) SET search_path = public;
ALTER FUNCTION public.get_auth_logs() SET search_path = public;
ALTER FUNCTION public.change_user_role(uuid, user_role, text) SET search_path = public;
ALTER FUNCTION public.cleanup_test_accounts() SET search_path = public;
ALTER FUNCTION public.get_user_upcoming_meetings(uuid, integer) SET search_path = public;
ALTER FUNCTION public.is_org_member(uuid) SET search_path = public;
ALTER FUNCTION public.check_is_attendee(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 2. Fix "Public Can Execute SECURITY DEFINER Function" (WARN)
-- Prevent unauthenticated (anon) users from executing these sensitive functions via the REST API.
REVOKE EXECUTE ON FUNCTION public.check_is_attendee(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_user_with_role(varchar, varchar, user_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.change_user_role(uuid, user_role, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_test_accounts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_upcoming_meetings(uuid, integer) FROM anon;

-- Also revoke handle_new_user from authenticated and public since it's only meant to be called by the auth trigger
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

-- 3. Fix "RLS Policy Always True" (WARN)
-- The notifications table had an overly permissive INSERT policy (WITH CHECK (true)).
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;

CREATE POLICY "Users can create notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());
-- Fix anon warnings by revoking from PUBLIC
REVOKE EXECUTE ON FUNCTION public.check_is_attendee(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.check_is_attendee(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon;

-- Grant to authenticated so they can still use them via RLS or directly
GRANT EXECUTE ON FUNCTION public.check_is_attendee(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
-- Create a private schema for internal RLS helper functions
CREATE SCHEMA IF NOT EXISTS private;

-- Grant usage so authenticated users can execute policies that reference private functions
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- 1. Move check_is_attendee to private schema
ALTER FUNCTION public.check_is_attendee(uuid, uuid) SET SCHEMA private;

-- Update the RLS policies on meetings to use the private schema function
DROP POLICY IF EXISTS "Users can view meetings" ON public.meetings;
CREATE POLICY "Users can view meetings"
ON public.meetings FOR SELECT
USING (
  creator_id = auth.uid()::uuid OR 
  private.check_is_attendee(id, auth.uid()::uuid)
);

-- Update the RLS policies on meeting_attendees to use the private schema function
DROP POLICY IF EXISTS "Users can see attendees of their meetings" ON public.meeting_attendees;
CREATE POLICY "Users can see attendees of their meetings"
ON public.meeting_attendees FOR SELECT
USING (
  user_id = auth.uid()::uuid OR
  private.check_is_attendee(meeting_id, auth.uid()::uuid)
);

-- 2. Move is_org_member to private schema
ALTER FUNCTION public.is_org_member(uuid) SET SCHEMA private;

-- Update the RLS policies on user_organizations to use the private schema function
DROP POLICY IF EXISTS "Users can see other members in their orgs" ON public.user_organizations;
CREATE POLICY "Users can see other members in their orgs"
  ON public.user_organizations FOR SELECT
  USING (
    user_id = auth.uid()::uuid OR private.is_org_member(org_id)
  );

DROP POLICY IF EXISTS "Users can join an org or be added" ON public.user_organizations;
CREATE POLICY "Users can join an org or be added"
  ON public.user_organizations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::uuid OR private.is_org_member(org_id)
  );

-- 3. Replace get_auth_logs function with a secure View to avoid function execute warnings
DROP FUNCTION IF EXISTS public.get_auth_logs();

CREATE OR REPLACE VIEW public.auth_logs AS
SELECT id, payload, created_at
FROM auth.audit_log_entries
WHERE EXISTS (
  SELECT 1 FROM public.users
  WHERE id = auth.uid()::uuid
  AND role IN ('managing_director', 'ceo', 'cto')
);

-- Grant select on the view to authenticated users
GRANT SELECT ON public.auth_logs TO authenticated;
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
-- Set the search_path explicitly on the new public wrapper function to satisfy the linter
ALTER FUNCTION public.get_auth_logs() SET search_path = public;
-- Grant execute permissions back to the auth service so it can run the trigger when saving a new user
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
-- Restore default PUBLIC execute permission for the trigger function
-- Trigger functions cannot be executed manually anyway, and Supabase Auth requires this to work properly.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC;
-- Reset the search path on the trigger function.
-- Setting search_path to public exclusively might be breaking internal Postgres trigger references 
-- or access to the auth schema's internal types.
ALTER FUNCTION public.handle_new_user() RESET search_path;
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
-- Migration: Setup Enterprise Invoice Generator System
-- Path: d:\projects\coreflow\supabase\migrations\20260613190000_enterprise_invoice_generator.sql

-- 1. Create Roles & Permissions Table
CREATE TABLE IF NOT EXISTS public.roles (
  role_name VARCHAR(50) PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Populate Default Role Permissions
INSERT INTO public.roles (role_name, permissions) VALUES
('managing_director', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "manage_roles", "view_audit_log", "manage_test_accounts", "schedule_meetings", "view_team_directory"]'::jsonb),
('ceo', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "manage_roles", "view_audit_log", "manage_test_accounts", "schedule_meetings", "view_team_directory"]'::jsonb),
('cto', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "manage_roles", "view_audit_log", "manage_test_accounts", "schedule_meetings", "view_team_directory"]'::jsonb),
('project_manager', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "schedule_meetings", "view_team_directory"]'::jsonb),
('hr', '["view_invoices", "schedule_meetings", "view_team_directory"]'::jsonb),
('developer', '["schedule_meetings", "view_team_directory"]'::jsonb),
('general_member', '["schedule_meetings", "view_team_directory"]'::jsonb),
('freelancer', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "schedule_meetings", "view_team_directory"]'::jsonb)
ON CONFLICT (role_name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- 2. Create Dynamic SQL Permission Checker
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR(50);
  v_has BOOLEAN;
BEGIN
  SELECT role::VARCHAR INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT (permissions ? p_permission) INTO v_has
  FROM public.roles
  WHERE role_name = v_role;
  RETURN COALESCE(v_has, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 3. Create Sequences Table
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_sequence INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, year),
  CONSTRAINT unique_owner_year_freelancer UNIQUE (owner_id, year)
);

-- 4. Create Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  gst_number VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Bill References Table
CREATE TABLE IF NOT EXISTS public.bill_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_bucket VARCHAR(100) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB DEFAULT '{}'::jsonb,
  ocr_provider VARCHAR(50),
  ocr_confidence NUMERIC,
  ocr_processed_at TIMESTAMP WITH TIME ZONE,
  extraction_version VARCHAR(20),
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT,
  bill_reference_id UUID REFERENCES public.bill_references(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  issue_date DATE DEFAULT CURRENT_DATE NOT NULL,
  due_date DATE NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  base_currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC DEFAULT 1,
  exchange_rate_date DATE,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency VARCHAR(50),
  next_run_date DATE,
  last_generated_at TIMESTAMP WITH TIME ZONE,
  recurring_end_date DATE,
  recurring_active BOOLEAN DEFAULT TRUE,
  template_style VARCHAR(50) DEFAULT 'classic',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  rate NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  hsn_code VARCHAR(50),
  sac_code VARCHAR(50),
  unit VARCHAR(20) DEFAULT 'units',
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  amount NUMERIC NOT NULL
);

-- 8. Create Invoice Taxes Table
CREATE TABLE IF NOT EXISTS public.invoice_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tax_name VARCHAR(50) NOT NULL,
  tax_rate NUMERIC NOT NULL,
  tax_amount NUMERIC NOT NULL
);

-- 9. Create Invoice Payments Table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(100),
  transaction_reference TEXT,
  received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Create Payment Receipts Table
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.invoice_payments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(100) UNIQUE NOT NULL,
  pdf_url TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Create Invoice Audit Logs Table
CREATE TABLE IF NOT EXISTS public.invoice_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_owner ON public.invoices(owner_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_num ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON public.invoices(is_deleted);

CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clients_owner ON public.clients(owner_id) WHERE is_deleted = FALSE;

-- 12. Transactional Sequence Generator Function
CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(
  p_org_id UUID,
  p_owner_id UUID,
  p_year INTEGER
)
RETURNS VARCHAR AS $$
DECLARE
  v_seq_record RECORD;
  v_next_seq INTEGER;
  v_num VARCHAR;
BEGIN
  IF p_org_id IS NOT NULL THEN
    INSERT INTO public.invoice_sequences (organization_id, owner_id, year, last_sequence)
    VALUES (p_org_id, p_owner_id, p_year, 0)
    ON CONFLICT (organization_id, year) DO NOTHING;
    
    SELECT * INTO v_seq_record
    FROM public.invoice_sequences
    WHERE organization_id = p_org_id AND year = p_year
    FOR UPDATE;
  ELSE
    INSERT INTO public.invoice_sequences (organization_id, owner_id, year, last_sequence)
    VALUES (NULL, p_owner_id, p_year, 0)
    ON CONFLICT (owner_id, year) DO NOTHING;
    
    SELECT * INTO v_seq_record
    FROM public.invoice_sequences
    WHERE organization_id IS NULL AND owner_id = p_owner_id AND year = p_year
    FOR UPDATE;
  END IF;

  v_next_seq := v_seq_record.last_sequence + 1;

  UPDATE public.invoice_sequences
  SET last_sequence = v_next_seq
  WHERE id = v_seq_record.id;

  v_num := 'CF-' || p_year::TEXT || '-' || lpad(v_next_seq::TEXT, 5, '0');
  RETURN v_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Set invoice number before insert trigger
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM COALESCE(NEW.issue_date, CURRENT_DATE))::INTEGER;
  NEW.invoice_number := public.generate_next_invoice_number(NEW.organization_id, NEW.owner_id, v_year);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.set_invoice_number();

-- 13. Dynamic Invoice Totals Recalculation Engine
CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_paid_amount NUMERIC := 0;
  v_balance_due NUMERIC := 0;
  v_due_date DATE;
  v_status VARCHAR(50);
BEGIN
  SELECT discount_amount, due_date, status INTO v_discount_amount, v_due_date, v_status
  FROM public.invoices WHERE id = p_invoice_id;
  
  SELECT 
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(tax_amount), 0)
  INTO v_subtotal, v_tax_amount
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;
  
  v_total_amount := v_subtotal + v_tax_amount - COALESCE(v_discount_amount, 0);
  IF v_total_amount < 0 THEN
    v_total_amount := 0;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid_amount
  FROM public.invoice_payments
  WHERE invoice_id = p_invoice_id;

  v_balance_due := v_total_amount - v_paid_amount;
  IF v_balance_due < 0 THEN
    v_balance_due := 0;
  END IF;

  IF v_status = 'cancelled' THEN
    -- keep cancelled
  ELSIF v_status = 'draft' THEN
    IF v_paid_amount > 0 THEN
      IF v_balance_due = 0 THEN
        v_status := 'paid';
      ELSE
        v_status := 'partially_paid';
      END IF;
    END IF;
  ELSE
    IF v_balance_due = 0 THEN
      v_status := 'paid';
    ELSIF v_paid_amount > 0 THEN
      v_status := 'partially_paid';
    ELSE
      IF v_due_date < CURRENT_DATE THEN
        v_status := 'overdue';
      ELSE
        v_status := 'sent';
      END IF;
    END IF;
  END IF;

  UPDATE public.invoices
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total_amount = v_total_amount,
    paid_amount = v_paid_amount,
    balance_due = v_balance_due,
    status = v_status,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recalculation triggers on item and payment changes
CREATE OR REPLACE FUNCTION public.trg_recalculate_invoice_items()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_invoice_totals(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_invoice_totals(NEW.invoice_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_items_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_invoice_items();

CREATE OR REPLACE TRIGGER trg_payments_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_invoice_items();

-- Automatic receipt generation trigger
CREATE OR REPLACE FUNCTION public.trg_generate_payment_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_rec_num VARCHAR;
BEGIN
  v_rec_num := 'REC-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || lpad(floor(random() * 1000000)::TEXT, 6, '0');
  INSERT INTO public.payment_receipts (payment_id, receipt_number, pdf_url)
  VALUES (NEW.id, v_rec_num, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_create_receipt
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_generate_payment_receipt();

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_audit_logs ENABLE ROW LEVEL SECURITY;

-- 14. Row-Level Security Policies
-- SELECT, INSERT, UPDATE, DELETE policies for clients
CREATE POLICY "Select clients" ON public.clients FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = auth.uid()) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
       public.has_permission(auth.uid(), 'view_invoices'))
    )
  );

CREATE POLICY "Insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_clients'))
  );

CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_clients'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_clients'))
  );

CREATE POLICY "Delete clients" ON public.clients FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_clients'))
  );

-- SELECT, INSERT, UPDATE, DELETE policies for invoices
CREATE POLICY "Select invoices" ON public.invoices FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = auth.uid()) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
       public.has_permission(auth.uid(), 'view_invoices'))
    )
  );

CREATE POLICY "Insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'create_invoices'))
  );

CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'edit_invoices'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'edit_invoices'))
  );

CREATE POLICY "Delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'delete_invoices'))
  );

-- SELECT, INSERT, UPDATE, DELETE policies for bill references
CREATE POLICY "Select bill references" ON public.bill_references FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'view_invoices'))
  );

CREATE POLICY "Insert bill references" ON public.bill_references FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_bill_references'))
  );

-- Enable access to child tables if parent invoice is readable
CREATE POLICY "Select items" ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

CREATE POLICY "Insert items" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = auth.uid()) OR
    (i.organization_id IS NOT NULL AND public.has_permission(auth.uid(), 'create_invoices'))
  )));

CREATE POLICY "Select payments" ON public.invoice_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

CREATE POLICY "Insert payments" ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = auth.uid()) OR
    (i.organization_id IS NOT NULL AND public.has_permission(auth.uid(), 'record_payments'))
  )));

-- Policies for invoice_sequences
CREATE POLICY "Select invoice sequences" ON public.invoice_sequences FOR SELECT TO authenticated
  USING (
    (owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()))
  );

-- Policies for invoice_taxes
CREATE POLICY "Select taxes" ON public.invoice_taxes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

CREATE POLICY "Insert taxes" ON public.invoice_taxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = auth.uid()) OR
    (i.organization_id IS NOT NULL AND public.has_permission(auth.uid(), 'create_invoices'))
  )));

-- Policies for payment_receipts
CREATE POLICY "Select receipts" ON public.payment_receipts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice_payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE p.id = payment_id
  ));

-- Allow view access to audit logs for managers/freelancers
CREATE POLICY "Select audit logs" ON public.invoice_audit_logs FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND user_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'view_audit_log'))
  );

-- SELECT policy for roles table
CREATE POLICY "Select roles" ON public.roles FOR SELECT TO authenticated
  USING (true);

-- Restrict execute permissions on internal SECURITY DEFINER functions to prevent RPC execution
REVOKE EXECUTE ON FUNCTION public.generate_next_invoice_number(UUID, UUID, INTEGER) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_invoice_number() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_generate_payment_receipt() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalculate_invoice_items() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_next_invoice_number(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_invoice_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_generate_payment_receipt() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_recalculate_invoice_items() TO service_role;
-- Migration: Ensure all enterprise columns exist on public.invoices and reload schema cache
-- Path: d:\projects\coreflow\supabase\migrations\20260613191000_add_missing_invoice_columns.sql

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cgst NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sgst NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS igst NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS template_style VARCHAR(50) DEFAULT 'classic';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recurring_frequency VARCHAR(50);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS next_run_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recurring_end_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recurring_active BOOLEAN DEFAULT TRUE;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: Fix Database Linter Warnings (RLS and SECURITY DEFINER permissions)
-- Path: d:\projects\coreflow\supabase\migrations\20260614083000_enable_rls_on_roles.sql

-- 1. Enable Row Level Security (RLS) on roles table and add SELECT policy
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select roles" ON public.roles;
CREATE POLICY "Select roles" ON public.roles FOR SELECT TO authenticated
  USING (true);

-- 2. Fix mutable search path for handle_deleted_user
ALTER FUNCTION public.handle_deleted_user() SET search_path = public;

-- 3. Restrict execute permissions for auth trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_deleted_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_deleted_user() TO supabase_auth_admin, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;

-- 4. Change has_permission from SECURITY DEFINER to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR(50);
  v_has BOOLEAN;
BEGIN
  SELECT role::VARCHAR INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT (permissions ? p_permission) INTO v_has
  FROM public.roles
  WHERE role_name = v_role;
  RETURN COALESCE(v_has, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 5. Restrict execute permissions on internal SECURITY DEFINER functions to prevent RPC execution
REVOKE EXECUTE ON FUNCTION public.generate_next_invoice_number(UUID, UUID, INTEGER) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_invoice_number() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_generate_payment_receipt() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalculate_invoice_items() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_next_invoice_number(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_invoice_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_generate_payment_receipt() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_recalculate_invoice_items() TO service_role;

-- 6. Define policies for tables that have RLS enabled but no policies
DROP POLICY IF EXISTS "Select invoice sequences" ON public.invoice_sequences;
CREATE POLICY "Select invoice sequences" ON public.invoice_sequences FOR SELECT TO authenticated
  USING (
    (owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Select taxes" ON public.invoice_taxes;
CREATE POLICY "Select taxes" ON public.invoice_taxes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

DROP POLICY IF EXISTS "Insert taxes" ON public.invoice_taxes;
CREATE POLICY "Insert taxes" ON public.invoice_taxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = auth.uid()) OR
    (i.organization_id IS NOT NULL AND public.has_permission(auth.uid(), 'create_invoices'))
  )));

DROP POLICY IF EXISTS "Select receipts" ON public.payment_receipts;
CREATE POLICY "Select receipts" ON public.payment_receipts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice_payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE p.id = payment_id
  ));

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: Fix auth_rls_initplan and multiple_permissive_policies linter warnings
-- Path: supabase/migrations/20260616145000_fix_auth_rls_initplan.sql

-- =======================================================================
-- 1. Table: public.users
-- =======================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Select users" ON public.users;
CREATE POLICY "Select users" ON public.users FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Only admins can change user roles" ON public.users;
DROP POLICY IF EXISTS "Admins can soft-delete users" ON public.users;
DROP POLICY IF EXISTS "Update users" ON public.users;
CREATE POLICY "Update users" ON public.users FOR UPDATE TO authenticated
  USING (
    (select auth.uid())::text = id::text OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  )
  WITH CHECK (
    (select auth.uid())::text = id::text OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );


-- =======================================================================
-- 2. Table: public.jwt_tokens
-- =======================================================================
DROP POLICY IF EXISTS "Users can view own tokens" ON public.jwt_tokens;
CREATE POLICY "Users can view own tokens" ON public.jwt_tokens FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can revoke own tokens" ON public.jwt_tokens;
CREATE POLICY "Users can revoke own tokens" ON public.jwt_tokens FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));


-- =======================================================================
-- 3. Table: public.meetings
-- =======================================================================
DROP POLICY IF EXISTS "Users can view own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view invited meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Select meetings" ON public.meetings;
CREATE POLICY "Select meetings" ON public.meetings FOR SELECT TO authenticated
  USING (
    creator_id = (select auth.uid()) OR 
    private.check_is_attendee(id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;
CREATE POLICY "Users can create meetings" ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own meetings" ON public.meetings;
CREATE POLICY "Users can update own meetings" ON public.meetings FOR UPDATE TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own meetings" ON public.meetings;
CREATE POLICY "Users can delete own meetings" ON public.meetings FOR DELETE TO authenticated
  USING (creator_id = (select auth.uid()));


-- =======================================================================
-- 4. Table: public.meeting_attendees
-- =======================================================================
DROP POLICY IF EXISTS "Users can see attendees of their meetings" ON public.meeting_attendees;
DROP POLICY IF EXISTS "Users can view meeting attendees" ON public.meeting_attendees;
DROP POLICY IF EXISTS "Select meeting attendees" ON public.meeting_attendees;
CREATE POLICY "Select meeting attendees" ON public.meeting_attendees FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = (select auth.uid())
    ) OR
    private.check_is_attendee(meeting_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Meeting creators can add attendees" ON public.meeting_attendees;
CREATE POLICY "Meeting creators can add attendees" ON public.meeting_attendees FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own RSVP" ON public.meeting_attendees;
CREATE POLICY "Users can update own RSVP" ON public.meeting_attendees FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Meeting creators can remove attendees" ON public.meeting_attendees;
CREATE POLICY "Meeting creators can remove attendees" ON public.meeting_attendees FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = (select auth.uid())
    )
  );


-- =======================================================================
-- 5. Table: public.role_change_audit
-- =======================================================================
DROP POLICY IF EXISTS "Only admins can view role audit" ON public.role_change_audit;
CREATE POLICY "Only admins can view role audit" ON public.role_change_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

DROP POLICY IF EXISTS "Only admins can create role audit" ON public.role_change_audit;
CREATE POLICY "Only admins can create role audit" ON public.role_change_audit FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );


-- =======================================================================
-- 6. Table: public.notifications
-- =======================================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));


-- =======================================================================
-- 7. Table: public.test_accounts
-- =======================================================================
DROP POLICY IF EXISTS "Only admins can view test accounts" ON public.test_accounts;
CREATE POLICY "Only admins can view test accounts" ON public.test_accounts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

DROP POLICY IF EXISTS "Only admins can delete test accounts" ON public.test_accounts;
CREATE POLICY "Only admins can delete test accounts" ON public.test_accounts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );


-- =======================================================================
-- 8. Table: public.activity_feed
-- =======================================================================
DROP POLICY IF EXISTS "Users can create activity feed" ON public.activity_feed;
CREATE POLICY "Users can create activity feed" ON public.activity_feed FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));


-- =======================================================================
-- 9. Table: public.user_organizations
-- =======================================================================
DROP POLICY IF EXISTS "Users can see other members in their orgs" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can view their own org memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Select user organizations" ON public.user_organizations;
CREATE POLICY "Select user organizations" ON public.user_organizations FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR private.is_org_member(org_id)
  );

DROP POLICY IF EXISTS "Users can join an org or be added" ON public.user_organizations;
CREATE POLICY "Users can join an org or be added" ON public.user_organizations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) OR private.is_org_member(org_id)
  );


-- =======================================================================
-- 10. Table: public.clients
-- =======================================================================
DROP POLICY IF EXISTS "Select clients" ON public.clients;
CREATE POLICY "Select clients" ON public.clients FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = (select auth.uid())) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
       public.has_permission((select auth.uid()), 'view_invoices'))
    )
  );

DROP POLICY IF EXISTS "Insert clients" ON public.clients;
CREATE POLICY "Insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_clients'))
  );

DROP POLICY IF EXISTS "Update clients" ON public.clients;
CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_clients'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_clients'))
  );

DROP POLICY IF EXISTS "Delete clients" ON public.clients;
CREATE POLICY "Delete clients" ON public.clients FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_clients'))
  );


-- =======================================================================
-- 11. Table: public.user_preferences
-- =======================================================================
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);


-- =======================================================================
-- 12. Table: public.organizations
-- =======================================================================
DROP POLICY IF EXISTS "Any authenticated user can create an org" ON public.organizations;
CREATE POLICY "Any authenticated user can create an org" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');


-- =======================================================================
-- 13. Table: public.invoices
-- =======================================================================
DROP POLICY IF EXISTS "Select invoices" ON public.invoices;
CREATE POLICY "Select invoices" ON public.invoices FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = (select auth.uid())) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
       public.has_permission((select auth.uid()), 'view_invoices'))
    )
  );

DROP POLICY IF EXISTS "Insert invoices" ON public.invoices;
CREATE POLICY "Insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'create_invoices'))
  );

DROP POLICY IF EXISTS "Update invoices" ON public.invoices;
CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'edit_invoices'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'edit_invoices'))
  );

DROP POLICY IF EXISTS "Delete invoices" ON public.invoices;
CREATE POLICY "Delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'delete_invoices'))
  );


-- =======================================================================
-- 14. Table: public.bill_references
-- =======================================================================
DROP POLICY IF EXISTS "Select bill references" ON public.bill_references;
CREATE POLICY "Select bill references" ON public.bill_references FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'view_invoices'))
  );

DROP POLICY IF EXISTS "Insert bill references" ON public.bill_references;
CREATE POLICY "Insert bill references" ON public.bill_references FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_bill_references'))
  );


-- =======================================================================
-- 15. Table: public.invoice_items
-- =======================================================================
DROP POLICY IF EXISTS "Insert items" ON public.invoice_items;
CREATE POLICY "Insert items" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid()), 'create_invoices'))
  )));


-- =======================================================================
-- 16. Table: public.invoice_payments
-- =======================================================================
DROP POLICY IF EXISTS "Insert payments" ON public.invoice_payments;
CREATE POLICY "Insert payments" ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid()), 'record_payments'))
  )));


-- =======================================================================
-- 17. Table: public.invoice_sequences
-- =======================================================================
DROP POLICY IF EXISTS "Select invoice sequences" ON public.invoice_sequences;
CREATE POLICY "Select invoice sequences" ON public.invoice_sequences FOR SELECT TO authenticated
  USING (
    (owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())))
  );


-- =======================================================================
-- 18. Table: public.invoice_taxes
-- =======================================================================
DROP POLICY IF EXISTS "Insert taxes" ON public.invoice_taxes;
CREATE POLICY "Insert taxes" ON public.invoice_taxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid()), 'create_invoices'))
  )));


-- =======================================================================
-- 19. Table: public.invoice_audit_logs
-- =======================================================================
DROP POLICY IF EXISTS "Select audit logs" ON public.invoice_audit_logs;
CREATE POLICY "Select audit logs" ON public.invoice_audit_logs FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND user_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'view_audit_log'))
  );


-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: Index unindexed foreign keys to resolve database linter INFO warnings
-- Path: supabase/migrations/20260616150000_add_foreign_key_indexes.sql

-- 1. Table: public.activity_feed
CREATE INDEX IF NOT EXISTS idx_activity_feed_related_meeting_id 
  ON public.activity_feed(related_meeting_id);

CREATE INDEX IF NOT EXISTS idx_activity_feed_related_user_id 
  ON public.activity_feed(related_user_id);


-- 2. Table: public.bill_references
CREATE INDEX IF NOT EXISTS idx_bill_references_organization_id 
  ON public.bill_references(organization_id);

CREATE INDEX IF NOT EXISTS idx_bill_references_owner_id 
  ON public.bill_references(owner_id);

CREATE INDEX IF NOT EXISTS idx_bill_references_uploaded_by 
  ON public.bill_references(uploaded_by);


-- 3. Table: public.clients
CREATE INDEX IF NOT EXISTS idx_clients_created_by 
  ON public.clients(created_by);

CREATE INDEX IF NOT EXISTS idx_clients_deleted_by 
  ON public.clients(deleted_by);


-- 4. Table: public.invoice_audit_logs
CREATE INDEX IF NOT EXISTS idx_invoice_audit_logs_organization_id 
  ON public.invoice_audit_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoice_audit_logs_user_id 
  ON public.invoice_audit_logs(user_id);


-- 5. Table: public.invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id 
  ON public.invoice_items(invoice_id);


-- 6. Table: public.invoice_payments
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id 
  ON public.invoice_payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_received_by 
  ON public.invoice_payments(received_by);


-- 7. Table: public.invoice_taxes
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_invoice_id 
  ON public.invoice_taxes(invoice_id);


-- 8. Table: public.invoices
CREATE INDEX IF NOT EXISTS idx_invoices_bill_reference_id 
  ON public.invoices(bill_reference_id);

CREATE INDEX IF NOT EXISTS idx_invoices_creator_id 
  ON public.invoices(creator_id);

CREATE INDEX IF NOT EXISTS idx_invoices_deleted_by 
  ON public.invoices(deleted_by);


-- 9. Table: public.meetings
CREATE INDEX IF NOT EXISTS idx_meetings_parent_meeting_id 
  ON public.meetings(parent_meeting_id);


-- 10. Table: public.notifications
CREATE INDEX IF NOT EXISTS idx_notifications_related_meeting_id 
  ON public.notifications(related_meeting_id);


-- 11. Table: public.payment_receipts
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_id 
  ON public.payment_receipts(payment_id);
-- Add missing SELECT policy for activity_feed table
DROP POLICY IF EXISTS "Users can view activity feed" ON public.activity_feed;
CREATE POLICY "Users can view activity feed" ON public.activity_feed FOR SELECT TO authenticated
  USING (true);
-- Fix: Allow authenticated users to search organizations by name
-- This is required for the "Join an existing organization" flow in register.tsx
-- Previously, RLS only allowed viewing orgs the user already belonged to,
-- which made it impossible to search for an org to join.

DROP POLICY IF EXISTS "Users can view orgs they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Any authenticated user can create an org" ON public.organizations;

-- Any authenticated user can view/search all organizations
-- (needed to find an org by name before joining it)
CREATE POLICY "Authenticated users can view all organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can create an org
CREATE POLICY "Any authenticated user can create an org"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- CoreFlow Enterprise Foundation â€” Phase 1
-- New role hierarchy, departments, extended profiles, PBAC
-- Run this in: Supabase Dashboard â†’ SQL Editor
-- ============================================================

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 1: Extend the user_role enum with new hierarchy values
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrator';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'director';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senior_manager';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'team_lead';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senior_employee';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'intern';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 2: Migrate existing users to new role hierarchy
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- managing_director / ceo / cto â†’ owner (they created the org)
UPDATE public.users
SET role = 'owner'
WHERE role IN ('managing_director', 'ceo', 'cto');

-- hr â†’ administrator
UPDATE public.users
SET role = 'administrator'
WHERE role = 'hr';

-- project_manager â†’ manager
UPDATE public.users
SET role = 'manager'
WHERE role = 'project_manager';

-- developer / general_member â†’ employee
UPDATE public.users
SET role = 'employee'
WHERE role IN ('developer', 'general_member');

-- freelancer stays freelancer

-- Also migrate user_organizations.role column
UPDATE public.user_organizations
SET role = 'owner'
WHERE role IN ('managing_director', 'ceo', 'cto');

UPDATE public.user_organizations
SET role = 'administrator'
WHERE role = 'hr';

UPDATE public.user_organizations
SET role = 'manager'
WHERE role = 'project_manager';

UPDATE public.user_organizations
SET role = 'employee'
WHERE role IN ('developer', 'general_member');

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 3: Extend users table with enterprise profile fields
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 4: Extend organizations table
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS size_category TEXT DEFAULT 'small'
    CHECK (size_category IN ('solo','small','medium','large','enterprise')),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 5: Extend user_organizations
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.user_organizations
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 6: Create departments table
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.departments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6B7280',
  head_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON public.departments(org_id);

-- RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Members of the org can view departments
CREATE POLICY IF NOT EXISTS "Org members can view departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = departments.org_id
        AND user_id = (select auth.uid())::uuid
    )
  );

-- Only owner/administrator can create departments
CREATE POLICY IF NOT EXISTS "Admins can create departments"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = departments.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

-- Only owner/administrator can update departments
CREATE POLICY IF NOT EXISTS "Admins can update departments"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = departments.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 7: Create role_permissions table (custom permission overrides)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS public.role_permissions (
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_user ON public.role_permissions(user_id, org_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Owners can manage custom permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = role_permissions.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

CREATE POLICY IF NOT EXISTS "Users can view own permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 8: Supabase Storage â€” avatars bucket
-- (Run separately in Storage dashboard if this fails)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their own folder
CREATE POLICY IF NOT EXISTS "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY IF NOT EXISTS "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY IF NOT EXISTS "Anyone can view avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 9: Seed default departments for existing orgs
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO public.departments (org_id, name, color)
SELECT DISTINCT id, 'General', '#1F6FEB' FROM public.organizations
ON CONFLICT (org_id, name) DO NOTHING;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- STEP 10: Notify PostgREST to reload schema
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
NOTIFY pgrst, 'reload schema';

SELECT 
  'Phase 1 migration complete' AS status,
  (SELECT COUNT(*) FROM public.users WHERE role = 'owner') AS owners,
  (SELECT COUNT(*) FROM public.users WHERE role = 'administrator') AS admins,
  (SELECT COUNT(*) FROM public.users WHERE role = 'employee') AS employees,
  (SELECT COUNT(*) FROM public.users WHERE role = 'freelancer') AS freelancers,
  (SELECT COUNT(*) FROM public.departments) AS departments;
-- ============================================================
-- CoreFlow Enterprise â€” Phase 2: Projects & Tasks
-- ============================================================

-- 1. Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','review','completed','cancelled')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  owner_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_date     DATE,
  start_date   DATE,
  cover_color  TEXT DEFAULT '#1F6FEB',
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Project Members table
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','manager','member','viewer')),
  added_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  added_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- 3. Project Milestones table
CREATE TABLE IF NOT EXISTS public.project_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE,
  completed    BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done','blocked')),
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  assignee_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  due_date     DATE,
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  tags         TEXT[],
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 5. Task Comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 6. Task Activity table
CREATE TABLE IF NOT EXISTS public.task_activity (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action       TEXT NOT NULL, -- e.g., 'status_changed', 'assigned', 'commented', 'details_updated'
  old_value    TEXT,
  new_value    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_department_id ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON public.project_milestones(project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON public.tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON public.task_activity(task_id);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- RLS Policies
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- PROJECTS
CREATE POLICY "Users can view projects in their org"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = projects.org_id
        AND user_id = (select auth.uid())::uuid
    )
  );

-- Include a project addition option that is restrictedâ€”only the user who assigns or owns the project can add it.
-- And only owner, administrator, director, senior_manager, manager can create/add projects generally (as per permissions table).
CREATE POLICY "Authorized roles can insert projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = projects.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
    ) AND (
      created_by = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Authorized roles can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = projects.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
    )
  );

CREATE POLICY "Authorized roles can delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = projects.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );


-- PROJECT MEMBERS
CREATE POLICY "Users can view members of their project"
  ON public.project_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      JOIN public.projects p ON p.org_id = uo.org_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Managers can manage project members"
  ON public.project_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      JOIN public.projects p ON p.org_id = uo.org_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = (select auth.uid())::uuid
        AND uo.role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
    )
  );


-- MILESTONES
CREATE POLICY "Users can view milestones in their project"
  ON public.project_milestones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      WHERE p.id = project_milestones.project_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Managers can manage milestones"
  ON public.project_milestones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      WHERE p.id = project_milestones.project_id
        AND uo.user_id = (select auth.uid())::uuid
        AND uo.role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead')
    )
  );


-- TASKS
CREATE POLICY "Users can view tasks in their org"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = tasks.org_id
        AND user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Authorized roles can manage tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = tasks.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'senior_employee', 'employee')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = tasks.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'senior_employee', 'employee')
    )
  );


-- TASK COMMENTS
CREATE POLICY "Users can view comments of accessible tasks"
  ON public.task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.user_organizations uo ON uo.org_id = t.org_id
      WHERE t.id = task_comments.task_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Users can post comments on accessible tasks"
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())::uuid
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.user_organizations uo ON uo.org_id = t.org_id
      WHERE t.id = task_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "Users can edit/delete own comments"
  ON public.task_comments FOR UPDATE
  TO authenticated
  USING (author_id = (select auth.uid())::uuid);


-- TASK ACTIVITY
CREATE POLICY "Users can view activity of accessible tasks"
  ON public.task_activity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.user_organizations uo ON uo.org_id = t.org_id
      WHERE t.id = task_activity.task_id
        AND uo.user_id = (select auth.uid())::uuid
    )
  );

CREATE POLICY "System can log task activity"
  ON public.task_activity FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Triggers
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 1. Log Task Activity Trigger function
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := (select auth.uid())::uuid;
  
  -- If we can't determine who did it, default to the created_by/assignee or system account
  IF v_user_id IS NULL THEN
    v_user_id := COALESCE(new.assignee_id, new.created_by);
  END IF;

  IF v_user_id IS NULL THEN
    RETURN new;
  END IF;

  -- Log status change
  IF old.status IS DISTINCT FROM new.status THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (new.id, v_user_id, 'status_changed', old.status, new.status);
  END IF;

  -- Log assignee change
  IF old.assignee_id IS DISTINCT FROM new.assignee_id THEN
    INSERT INTO public.task_activity (task_id, user_id, action, old_value, new_value)
    VALUES (
      new.id, 
      v_user_id, 
      'assignee_changed', 
      (SELECT email FROM public.users WHERE id = old.assignee_id), 
      (SELECT email FROM public.users WHERE id = new.assignee_id)
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_task_update
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.log_task_activity();

-- 2. Notify Assignee Trigger function
CREATE OR REPLACE FUNCTION public.notify_task_assignee()
RETURNS trigger AS $$
BEGIN
  -- Insert into notifications table
  IF new.assignee_id IS NOT NULL AND (old.assignee_id IS DISTINCT FROM new.assignee_id OR tg_op = 'INSERT') THEN
    INSERT INTO public.notifications (user_id, title, message, type, is_read)
    VALUES (
      new.assignee_id,
      'Task Assigned',
      'You have been assigned to task: ' || new.title,
      'task_assigned',
      false
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_task_assignee();

NOTIFY pgrst, 'reload schema';
-- ============================================================
-- CoreFlow Enterprise â€” Phase 3: Chat System
-- ============================================================

-- 1. Chat Channels table
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES public.projects(id) ON DELETE CASCADE, -- NULL = org channel
  name         TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL CHECK (type IN ('org_general','org_announcement','project','direct')),
  is_private   BOOLEAN DEFAULT false,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Channel Members table (for DMs and private/project channels)
CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id   UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- 3. Chat Messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content      TEXT,
  file_url     TEXT,
  file_name    TEXT,
  file_type    TEXT,
  reply_to_id  UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_edited    BOOLEAN DEFAULT false,
  edited_at    TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ, -- soft delete
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Message Reads table
CREATE TABLE IF NOT EXISTS public.message_reads (
  message_id   UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_channels_org ON public.chat_channels(org_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_project ON public.chat_channels(project_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON public.message_reads(user_id);

-- Enable RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- RLS Policies
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- CHAT CHANNELS
DROP POLICY IF EXISTS "Users can view channels they belong to" ON public.chat_channels;
CREATE POLICY "Users can view channels they belong to"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (
    -- Org-wide channels: visible to non-freelancers of the organization
    (project_id IS NULL AND type IN ('org_general', 'org_announcement') AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = chat_channels.org_id
        AND user_id = (select auth.uid())::uuid
        AND role != 'freelancer'
    ))
    -- Project channels: visible to project members (including freelancers)
    OR (project_id IS NOT NULL AND type = 'project' AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = chat_channels.project_id
        AND user_id = (select auth.uid())::uuid
    ))
    -- Private channels and DMs: visible only to explicit channel members
    OR EXISTS (
      SELECT 1 FROM public.channel_members
      WHERE channel_id = chat_channels.id
        AND user_id = (select auth.uid())::uuid
    )
  );

DROP POLICY IF EXISTS "Authorized members can create channels" ON public.chat_channels;
CREATE POLICY "Authorized members can create channels"
  ON public.chat_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    -- DMs and general creation: must be in same org
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = chat_channels.org_id
        AND user_id = (select auth.uid())::uuid
        AND role != 'freelancer'
    )
  );

-- CHANNEL MEMBERS
DROP POLICY IF EXISTS "Users can see channel members" ON public.channel_members;
CREATE POLICY "Users can see channel members"
  ON public.channel_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = channel_members.channel_id
    )
  );

DROP POLICY IF EXISTS "Users can manage channel members" ON public.channel_members;
CREATE POLICY "Users can manage channel members"
  ON public.channel_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = channel_members.channel_id
        AND org_id IN (
          SELECT org_id FROM public.user_organizations
          WHERE user_id = (select auth.uid())::uuid
        )
    )
  );

-- CHAT MESSAGES
DROP POLICY IF EXISTS "Users can read channel messages" ON public.chat_messages;
CREATE POLICY "Users can read channel messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = chat_messages.channel_id
    )
  );

DROP POLICY IF EXISTS "Users can send channel messages" ON public.chat_messages;
CREATE POLICY "Users can send channel messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())::uuid
    AND EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = channel_id
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;
CREATE POLICY "Users can update own messages"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (sender_id = (select auth.uid())::uuid);

-- MESSAGE READS
DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;
CREATE POLICY "Users can view message reads"
  ON public.message_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages
      WHERE id = message_reads.message_id
    )
  );

DROP POLICY IF EXISTS "Users can update message reads" ON public.message_reads;
CREATE POLICY "Users can update message reads"
  ON public.message_reads FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Triggers
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- 1. Auto-create Org Chat channels on Org Creation
CREATE OR REPLACE FUNCTION public.create_default_org_channels()
RETURNS trigger AS $$
BEGIN
  -- Create general channel
  INSERT INTO public.chat_channels (org_id, name, description, type)
  VALUES (
    new.id,
    'general',
    'Company-wide discussions and general chat',
    'org_general'
  );

  -- Create announcements channel
  INSERT INTO public.chat_channels (org_id, name, description, type)
  VALUES (
    new.id,
    'announcements',
    'Company updates and announcements',
    'org_announcement'
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_created ON public.organizations;
CREATE TRIGGER on_org_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE PROCEDURE public.create_default_org_channels();

-- 2. Auto-create Project Chat channel on Project Creation
CREATE OR REPLACE FUNCTION public.create_project_channel()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.chat_channels (org_id, project_id, name, description, type)
  VALUES (
    new.org_id,
    new.id,
    'project-' || lower(replace(new.title, ' ', '-')),
    'Chat channel for project: ' || new.title,
    'project'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE PROCEDURE public.create_project_channel();

-- Enable Realtime publication for chat tables safely
DO $$
BEGIN
  -- Check if supabase_realtime publication exists, create it if not
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add chat_channels if it exists and is not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_channels') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND c.relname = 'chat_channels'
        AND n.nspname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
    END IF;
  END IF;

  -- Add channel_members if it exists and is not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'channel_members') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND c.relname = 'channel_members'
        AND n.nspname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
    END IF;
  END IF;

  -- Add chat_messages if it exists and is not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND c.relname = 'chat_messages'
        AND n.nspname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
-- Migration: Allow anon and authenticated users to read and insert organizations
-- This fixes the issue where registering users cannot search/join or create organizations because they are not yet authenticated.

-- 1. Redefine SELECT policy to allow anyone (anon and authenticated) to view organizations
DROP POLICY IF EXISTS "Authenticated users can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view orgs they belong to" ON public.organizations;

CREATE POLICY "Anyone can view all organizations"
  ON public.organizations FOR SELECT
  USING (true);

-- 2. Redefine INSERT policy to allow anyone (anon and authenticated) to create an organization
DROP POLICY IF EXISTS "Any authenticated user can create an org" ON public.organizations;

CREATE POLICY "Anyone can create an org"
  ON public.organizations FOR INSERT
  WITH CHECK (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- CoreFlow Enterprise â€” Phase 4: File Management + Audit Logs
-- ============================================================

-- 1. Files table
CREATE TABLE IF NOT EXISTS public.files (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id     UUID REFERENCES public.projects(id) ON DELETE CASCADE, -- NULL = organization wide file
  uploader_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  bucket         TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  file_size      BIGINT,
  mime_type      TEXT,
  version        INTEGER DEFAULT 1,
  parent_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL, -- for version tracking
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 2. Activity logs table (append-only)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,  -- e.g. 'role_changed', 'project_created', 'task_created', etc.
  entity_type  TEXT NOT NULL,  -- e.g. 'user', 'project', 'task', 'invoice', 'file'
  entity_id    UUID,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 3. Extend notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_org ON public.files(org_id);
CREATE INDEX IF NOT EXISTS idx_files_project ON public.files(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON public.activity_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- RLS Policies
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- FILES RLS
DROP POLICY IF EXISTS "Users can view org files" ON public.files;
CREATE POLICY "Users can view org files"
  ON public.files FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = (select auth.uid())::uuid
    )
    AND (
      -- Freelancer check: only allow files for projects they are assigned to
      (SELECT role FROM public.user_organizations WHERE user_id = (select auth.uid())::uuid LIMIT 1) != 'freelancer'
      OR (project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = files.project_id AND user_id = (select auth.uid())::uuid
      ))
    )
  );

DROP POLICY IF EXISTS "Users can upload files" ON public.files;
CREATE POLICY "Users can upload files"
  ON public.files FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.user_organizations
      WHERE user_id = (select auth.uid())::uuid
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = files.project_id AND user_id = (select auth.uid())::uuid
      )
    )
  );

-- ACTIVITY LOGS RLS (Append-only: Inserts allowed, Select restricted to Admin/Owner, no Updates/Deletes)
DROP POLICY IF EXISTS "Users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = (select auth.uid())::uuid
  );

DROP POLICY IF EXISTS "Owners and admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Owners and admins can view activity logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = activity_logs.org_id
        AND user_id = (select auth.uid())::uuid
        AND role IN ('owner', 'administrator')
    )
  );

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
-- ============================================================
-- CoreFlow Enterprise â€” Project Members Enhancement
-- Adds full audit tracking to project_members table
-- ============================================================

-- 1. Add audit columns to existing project_members table
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS assigned_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at  TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS removed_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notes        TEXT;

-- Migrate existing data: populate assigned_by from added_by if present
UPDATE public.project_members
  SET assigned_by = added_by,
      assigned_at = COALESCE(added_at, now())
  WHERE assigned_by IS NULL AND added_by IS NOT NULL;

-- 2. Add deleted_at column to projects if not present (for soft delete support)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_project_id
  ON public.project_members(project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON public.project_members(user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_is_active
  ON public.project_members(project_id, is_active);

CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON public.projects(deleted_at) WHERE deleted_at IS NULL;

-- 4. RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated org members to view project members for projects in their org
DROP POLICY IF EXISTS "Org members can view project members" ON public.project_members;
CREATE POLICY "Org members can view project members"
  ON public.project_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = auth.uid()
    )
  );

-- Allow users with assign_projects-equivalent roles to insert
DROP POLICY IF EXISTS "Managers can assign project members" ON public.project_members;
CREATE POLICY "Managers can assign project members"
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      JOIN public.users u ON u.id = uo.user_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = auth.uid()
        AND u.role IN ('owner','administrator','director','senior_manager','manager')
    )
  );

-- Allow managers to update (remove/restore) members
DROP POLICY IF EXISTS "Managers can update project members" ON public.project_members;
CREATE POLICY "Managers can update project members"
  ON public.project_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      JOIN public.users u ON u.id = uo.user_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = auth.uid()
        AND u.role IN ('owner','administrator','director','senior_manager','manager')
    )
  );

-- 5. Grant table permissions
GRANT SELECT, INSERT, UPDATE ON public.project_members TO authenticated;

-- 6. Notify trigger: insert activity log on member assignment
CREATE OR REPLACE FUNCTION public.notify_project_member_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title TEXT;
BEGIN
  -- Only fire on new active assignments
  IF NEW.is_active = TRUE AND (OLD IS NULL OR OLD.is_active = FALSE) THEN
    SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;

    -- Insert notification for the assigned user
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
    VALUES (
      NEW.user_id,
      'Added to Project',
      'You have been assigned to "' || COALESCE(v_project_title, 'a project') || '"',
      'project_assignment',
      NEW.project_id,
      'project',
      '/projects/' || NEW.project_id::TEXT,
      FALSE
    )
    ON CONFLICT DO NOTHING;

    -- Insert activity log
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (
      COALESCE(NEW.assigned_by, NEW.user_id),
      'member_assigned',
      'project',
      NEW.project_id,
      jsonb_build_object(
        'assigned_user_id', NEW.user_id,
        'project_title', v_project_title
      )
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_member_assigned ON public.project_members;
CREATE TRIGGER trg_project_member_assigned
  AFTER INSERT OR UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_member_assigned();
