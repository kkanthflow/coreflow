-- Migration: 20261018040000_subscription_payment_status.sql
-- Description: Add payment_status and last_payment tracking to subscriptions table

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) DEFAULT 'paid';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_payment_id VARCHAR(128);
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_payment_amount INTEGER;

CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_status ON public.subscriptions(payment_status);
