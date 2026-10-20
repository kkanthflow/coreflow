-- ============================================================
-- AUVRYN Enterprise: Payment Settings & Scoped Webhook Tokens
-- Migration: 20261021000004_payment_settings_and_webhook_token.sql
-- Supports both Organization and Freelancer account types
-- ============================================================

-- 1. Table: Payment Settings (One per business)
CREATE TABLE IF NOT EXISTS public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  key_id TEXT,
  key_secret TEXT,
  webhook_secret TEXT,
  webhook_token VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Exactly one of organization_id or owner_id must be set
  CONSTRAINT chk_payment_settings_business CHECK (
    (organization_id IS NOT NULL AND owner_id IS NULL) OR
    (organization_id IS NULL AND owner_id IS NOT NULL)
  )
);

-- Unique index ensuring one payment_settings row per business
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_settings_business
ON public.payment_settings (COALESCE(organization_id, owner_id));

-- Index for O(1) webhook token lookup
CREATE INDEX IF NOT EXISTS idx_payment_settings_token
ON public.payment_settings (webhook_token);

-- 2. Migrate existing records from business_gateway_configs if any exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'business_gateway_configs') THEN
    INSERT INTO public.payment_settings (
      organization_id,
      owner_id,
      provider,
      is_enabled,
      key_id,
      key_secret,
      webhook_secret,
      webhook_token
    )
    SELECT
      bgc.organization_id,
      CASE WHEN bgc.organization_id IS NOT NULL THEN NULL ELSE bgc.owner_id END,
      bgc.provider,
      bgc.is_enabled,
      bgc.key_id,
      bgc.key_secret,
      bgc.webhook_secret,
      encode(gen_random_bytes(32), 'hex')
    FROM public.business_gateway_configs bgc
    ON CONFLICT (COALESCE(organization_id, owner_id)) DO NOTHING;
  END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage payment settings" ON public.payment_settings;
CREATE POLICY "Manage payment settings" ON public.payment_settings
FOR ALL TO authenticated
USING (
  -- Freelancer: owns the row directly (organization_id is NULL)
  (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
  -- Organization: user is owner, administrator, or has record_payments permission
  (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = payment_settings.organization_id 
      AND uo.user_id = (select auth.uid())::uuid 
      AND (
        uo.role IN ('owner', 'administrator') 
        OR public.has_permission((select auth.uid())::uuid, 'record_payments')
      )
  ))
);

-- 4. Reversible Migration Comments:
-- To rollback:
-- DROP TABLE IF EXISTS public.payment_settings CASCADE;
