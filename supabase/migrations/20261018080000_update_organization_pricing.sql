-- Migration: 20261018080000_update_organization_pricing.sql
-- Description: Update organization subscription pricing:
--   Business Starter: ₹399/month
--   Business Pro: ₹499/month
-- Preserve Freelancer pricing:
--   Freelancer Free: ₹0/month
--   Freelancer Starter: ₹299/month
--   Freelancer Pro: ₹599/month

UPDATE public.subscription_plans
SET price_inr = 399,
    updated_at = NOW()
WHERE id IN ('business_starter', 'starter_monthly');

UPDATE public.subscription_plans
SET price_inr = 499,
    updated_at = NOW()
WHERE id IN ('business_pro', 'pro_monthly');
