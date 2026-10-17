-- ==============================================================================
-- AUVRYN MASTER MIGRATION: ACCOUNT SETUP, RBAC, SUBSCRIPTIONS & PAYER TRACKING
-- ==============================================================================

-- 1. Users table updates: Add account_type and account_setup_completed
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_setup_completed BOOLEAN DEFAULT false;

-- Preserve existing users: mark completed if they already have workspace or valid role
UPDATE public.users 
SET account_setup_completed = true 
WHERE (default_workspace_id IS NOT NULL AND default_workspace_id != '')
   OR role IN ('freelancer', 'owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'employee', 'developer');

-- Populate account_type for existing users
UPDATE public.users 
SET account_type = 'freelancer' 
WHERE role = 'freelancer' AND account_type IS NULL;

UPDATE public.users 
SET account_type = 'organization' 
WHERE (role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager', 'team_lead', 'employee', 'intern') 
       OR (default_workspace_id IS NOT NULL AND default_workspace_id != 'independent'))
  AND account_type IS NULL;

-- Remove dangerous defaults that previously caused automatic freelancer assignment
ALTER TABLE public.users ALTER COLUMN default_workspace_id DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN current_plan_tier DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN subscription_status SET DEFAULT 'free';

-- 2. Organizations table updates
ALTER TABLE public.organizations ALTER COLUMN current_plan_tier SET DEFAULT 'business_free';
ALTER TABLE public.organizations ALTER COLUMN subscription_status SET DEFAULT 'free';

-- 3. Subscriptions table updates: customer_type & payer_user_id separation
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS customer_type VARCHAR(32);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payer_user_id VARCHAR(64);

UPDATE public.subscriptions 
SET customer_type = CASE WHEN organization_id IS NOT NULL AND organization_id != '' THEN 'organization' ELSE 'freelancer' END 
WHERE customer_type IS NULL;

UPDATE public.subscriptions 
SET payer_user_id = user_id 
WHERE payer_user_id IS NULL;

-- 4. Subscription Payments table updates
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS payer_user_id VARCHAR(64);
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS customer_type VARCHAR(32);
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64);

-- 5. Trigger update: handle_new_user must NEVER automatically assign freelancer or workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

  -- Insert user or update if exists, with NULL default_workspace_id and account_setup_completed = false
  BEGIN
    INSERT INTO public.users (
      id, 
      email, 
      full_name, 
      role, 
      default_workspace_id, 
      account_type, 
      account_setup_completed,
      current_plan_tier,
      subscription_status
    )
    VALUES (
      new.id, 
      new.email, 
      COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      v_role,
      NULL,
      NULL,
      false,
      NULL,
      'free'
    );
  EXCEPTION WHEN unique_violation THEN
    -- If email exists, update the user with the new auth ID
    UPDATE public.users 
    SET id = new.id, 
        full_name = COALESCE(new.raw_user_meta_data->>'full_name', public.users.full_name)
    WHERE email = new.email;
  END;
  
  -- Automatically insert default preferences for the new user
  BEGIN
    INSERT INTO public.user_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN new;
END;
$$;

-- 6. Synchronize authoritative 6 plans into subscription_plans table
INSERT INTO public.subscription_plans (id, tier, interval, name, description, price_inr, max_seats, max_invoices_per_month, max_active_projects, max_meetings_per_month, analytics_tier, features, is_active)
VALUES
('freelancer_free', 'freelancer_free', 'monthly', 'Free', 'Individual workspace for solo specialists - Free tier', 0, 1, 15, 3, 20, 'basic', '["Maximum 3 projects", "Maximum 2 workflows", "1 user", "7-day history"]'::jsonb, true),
('freelancer_starter', 'freelancer_starter', 'monthly', 'Starter', 'Individual workspace with expanded projects and workflows', 299, 1, 50, 10, 50, 'basic', '["Maximum 10 projects", "Maximum 5 workflows", "1 user", "30-day history"]'::jsonb, true),
('freelancer_pro', 'freelancer_pro', 'monthly', 'Pro', 'Individual workspace with unlimited projects, workflows and usage', 599, 1, null, null, null, 'unlimited', '["Unlimited projects", "Unlimited workflows", "Unlimited usage for covered features", "1 user"]'::jsonb, true),

('business_free', 'business_free', 'monthly', 'Business Free', 'Team workspace for up to 3 members - Free tier', 0, 3, 25, 5, 25, 'basic', '["Maximum 5 projects", "Maximum 3 workflows", "Maximum 3 members, including owner", "7-day history"]'::jsonb, true),
('business_starter', 'business_starter', 'monthly', 'Business Starter', 'Collaborative operating workbench for agile teams', 999, 5, 150, 25, 100, 'standard', '["Maximum 25 projects", "Maximum 15 workflows", "Maximum 5 members", "30-day history"]'::jsonb, true),
('business_pro', 'business_pro', 'monthly', 'Business Pro', 'Uncapped velocity and enterprise governance without arbitrary limits', 2499, null, null, null, null, 'unlimited', '["Unlimited projects", "Unlimited workflows", "Unlimited team members", "Unlimited covered usage"]'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
  tier = EXCLUDED.tier,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_inr = EXCLUDED.price_inr,
  max_seats = EXCLUDED.max_seats,
  max_invoices_per_month = EXCLUDED.max_invoices_per_month,
  max_active_projects = EXCLUDED.max_active_projects,
  max_meetings_per_month = EXCLUDED.max_meetings_per_month,
  analytics_tier = EXCLUDED.analytics_tier,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = now();
