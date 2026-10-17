-- =====================================================================
-- Migration: 20261017160000_razorpay_subscriptions.sql
-- Description: Razorpay Subscriptions, Plans, Payments, Orders,
--              Webhook Events, Quota Tracking, and Custom Dev Inquiries
-- =====================================================================

-- 1. Subscription Plans Configuration Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id VARCHAR(64) PRIMARY KEY, -- e.g. 'freelancer_monthly', 'freelancer_yearly', 'starter_monthly', etc.
  tier VARCHAR(32) NOT NULL,   -- 'freelancer', 'starter', 'pro'
  interval VARCHAR(16) NOT NULL, -- 'monthly', 'yearly'
  name VARCHAR(128) NOT NULL,
  description TEXT,
  price_inr INTEGER NOT NULL,  -- In whole INR: 299, 2990, 399, 3990, 499, 4990
  razorpay_plan_id VARCHAR(128),
  max_seats INTEGER,           -- 1 for freelancer, 5 for starter, NULL for unlimited (pro)
  max_invoices_per_month INTEGER, -- 15 for freelancer, 100 for starter, NULL for unlimited (pro)
  max_active_projects INTEGER,    -- 5 for freelancer, 25 for starter, NULL for unlimited (pro)
  max_meetings_per_month INTEGER, -- 20 for freelancer, 100 for starter, NULL for unlimited (pro)
  analytics_tier VARCHAR(32) NOT NULL DEFAULT 'basic', -- 'basic', 'standard', 'unlimited'
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed Initial Plans
INSERT INTO public.subscription_plans (id, tier, interval, name, description, price_inr, max_seats, max_invoices_per_month, max_active_projects, max_meetings_per_month, analytics_tier, features)
VALUES
  ('freelancer_monthly', 'freelancer', 'monthly', 'Freelancer (Monthly)', 'Individual workspace with core workflow tools', 299, 1, 15, 5, 20, 'basic', 
   '["1 user workspace", "Up to 15 invoices/month", "Up to 5 active projects", "Up to 20 meetings/month", "Basic analytics", "Standard support"]'::jsonb),
  ('freelancer_yearly', 'freelancer', 'yearly', 'Freelancer (Yearly)', 'Individual workspace with core workflow tools - 2 months free', 2990, 1, 15, 5, 20, 'basic', 
   '["1 user workspace", "Up to 15 invoices/month", "Up to 5 active projects", "Up to 20 meetings/month", "Basic analytics", "2 months free equivalent", "Standard support"]'::jsonb),
  ('starter_monthly', 'starter', 'monthly', 'Business Starter (Monthly)', 'Team collaboration workspace with enhanced limits', 399, 5, 100, 25, 100, 'standard', 
   '["Up to 5 team members", "Organization workspace", "Up to 100 invoices/month", "Up to 25 active projects", "Up to 100 meetings/month", "Standard analytics", "Priority support"]'::jsonb),
  ('starter_yearly', 'starter', 'yearly', 'Business Starter (Yearly)', 'Team collaboration workspace - 2 months free', 3990, 5, 100, 25, 100, 'standard', 
   '["Up to 5 team members", "Organization workspace", "Up to 100 invoices/month", "Up to 25 active projects", "Up to 100 meetings/month", "Standard analytics", "2 months free equivalent", "Priority support"]'::jsonb),
  ('pro_monthly', 'pro', 'monthly', 'Auvryn Pro (Monthly)', 'Uncapped power and velocity for growing businesses', 499, NULL, NULL, NULL, NULL, 'unlimited', 
   '["Unlimited team seats", "Unlimited invoices", "Unlimited projects", "Unlimited meetings", "Unlimited analytics & reports", "Custom integrations", "Dedicated 24/7 support"]'::jsonb),
  ('pro_yearly', 'pro', 'yearly', 'Auvryn Pro (Yearly)', 'Uncapped power and velocity - 2 months free', 4990, NULL, NULL, NULL, NULL, 'unlimited', 
   '["Unlimited team seats", "Unlimited invoices", "Unlimited projects", "Unlimited meetings", "Unlimited analytics & reports", "Custom integrations", "2 months free equivalent", "Dedicated 24/7 support"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  price_inr = EXCLUDED.price_inr,
  max_seats = EXCLUDED.max_seats,
  max_invoices_per_month = EXCLUDED.max_invoices_per_month,
  max_active_projects = EXCLUDED.max_active_projects,
  max_meetings_per_month = EXCLUDED.max_meetings_per_month,
  features = EXCLUDED.features;

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL, -- User who created the subscription
  organization_id VARCHAR(64),  -- Organization associated with the subscription (for Starter / Pro)
  workspace_type VARCHAR(32) NOT NULL DEFAULT 'independent', -- 'independent' | 'organization'
  plan_tier VARCHAR(32) NOT NULL, -- 'freelancer', 'starter', 'pro'
  plan_interval VARCHAR(16) NOT NULL, -- 'monthly', 'yearly'
  plan_id VARCHAR(64) REFERENCES public.subscription_plans(id),
  razorpay_subscription_id VARCHAR(128) UNIQUE NOT NULL,
  razorpay_plan_id VARCHAR(128),
  razorpay_customer_id VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'created', -- 'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
  total_count INTEGER DEFAULT 12,
  paid_count INTEGER DEFAULT 0,
  short_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_rzp_sub ON public.subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- 3. Subscription Payments Table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  razorpay_subscription_id VARCHAR(128) NOT NULL,
  razorpay_payment_id VARCHAR(128) UNIQUE NOT NULL,
  razorpay_order_id VARCHAR(128),
  razorpay_invoice_id VARCHAR(128),
  amount INTEGER NOT NULL, -- In paise (e.g. 29900 for ₹299.00)
  currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
  status VARCHAR(32) NOT NULL, -- 'captured', 'failed', 'refunded'
  method VARCHAR(32),          -- 'card', 'upi', 'netbanking'
  error_code VARCHAR(128),
  error_description TEXT,
  captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_sub ON public.subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_rzp_id ON public.subscription_payments(razorpay_payment_id);

-- 4. Subscription Webhook Events (Idempotency Table)
CREATE TABLE IF NOT EXISTS public.subscription_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(128) UNIQUE NOT NULL, -- Razorpay event ID (x-razorpay-event-id or payload.event_id)
  event_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128),                -- subscription_id or payment_id
  payload JSONB NOT NULL,
  status VARCHAR(32) DEFAULT 'processed' NOT NULL, -- 'processed', 'ignored', 'failed'
  error_message TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_id ON public.subscription_webhook_events(event_id);

-- 5. Razorpay Standard Orders Table (For one-time checkout & UPI upfront)
CREATE TABLE IF NOT EXISTS public.razorpay_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(128) UNIQUE NOT NULL,
  amount INTEGER NOT NULL, -- in paise
  currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
  receipt VARCHAR(128),
  status VARCHAR(32) DEFAULT 'created' NOT NULL, -- 'created', 'paid', 'failed'
  payment_id VARCHAR(128),
  signature TEXT,
  user_id VARCHAR(64),
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_order_id ON public.razorpay_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_user_id ON public.razorpay_orders(user_id);

-- 6. Custom Development Inquiries Table
CREATE TABLE IF NOT EXISTS public.custom_development_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64),
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255) NOT NULL,
  business_email VARCHAR(320) NOT NULL,
  phone_number VARCHAR(50),
  preferred_contact_method VARCHAR(32) NOT NULL, -- 'email', 'phone', 'video_call'
  project_description TEXT NOT NULL,
  estimated_budget VARCHAR(64),
  status VARCHAR(32) DEFAULT 'new' NOT NULL,     -- 'new', 'in_review', 'contacted', 'quoted', 'closed'
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_dev_email ON public.custom_development_inquiries(business_email);

-- 7. Add Quota & Plan Columns to Users and Organizations (Safe & Idempotent)
DO $$ 
BEGIN
  -- User plan and quota tracking
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_plan_tier VARCHAR(32) DEFAULT 'freelancer';
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) DEFAULT 'active';
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invoices_used_this_month INTEGER DEFAULT 0;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS meetings_used_this_month INTEGER DEFAULT 0;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS projects_used_count INTEGER DEFAULT 0;
  END IF;

  -- Organization plan and quota tracking
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS current_plan_tier VARCHAR(32) DEFAULT 'freelancer';
    ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) DEFAULT 'none';
  END IF;
END $$;

-- 8. Row Level Security (RLS) Configuration
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_development_inquiries ENABLE ROW LEVEL SECURITY;

-- Plans are public read-only
DROP POLICY IF EXISTS "Public can view subscription plans" ON public.subscription_plans;
CREATE POLICY "Public can view subscription plans"
  ON public.subscription_plans FOR SELECT
  TO public
  USING (true);

-- Subscriptions are readable by the user who owns them
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Subscription payments are readable by the user who owns the subscription
DROP POLICY IF EXISTS "Users can view own subscription payments" ON public.subscription_payments;
CREATE POLICY "Users can view own subscription payments"
  ON public.subscription_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_id AND s.user_id = auth.uid()::text
    )
  );

-- Razorpay orders can be viewed by the user who placed them
DROP POLICY IF EXISTS "Users can view own razorpay orders" ON public.razorpay_orders;
CREATE POLICY "Users can view own razorpay orders"
  ON public.razorpay_orders FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid()::text);

-- Anyone can submit a custom development inquiry
DROP POLICY IF EXISTS "Anyone can submit inquiry" ON public.custom_development_inquiries;
CREATE POLICY "Anyone can submit inquiry"
  ON public.custom_development_inquiries FOR INSERT
  TO public
  WITH CHECK (true);

-- Authenticated users can view their own inquiries
DROP POLICY IF EXISTS "Users can view own inquiries" ON public.custom_development_inquiries;
CREATE POLICY "Users can view own inquiries"
  ON public.custom_development_inquiries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);
