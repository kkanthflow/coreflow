-- ============================================================
-- AUVRYN Enterprise: Remove Client Invoice Online Gateway
-- Migration: 20261021000005_remove_client_invoice_gateway.sql
-- ============================================================
-- Purpose:
-- Completely decommission online payment gateway infrastructure
-- for client invoices (merchant credentials, invoice webhook tokens,
-- idempotency webhooks ledger, and online clearance procedure).
--
-- Manual payment submissions (Phase 3), the immutable ledger
-- (invoice_payments), client portal accounts (Phase 1), client
-- invoices (Phase 2), and Auvryn platform subscription tables
-- (subscriptions, subscription_webhook_events) remain 100% intact.
-- ============================================================

-- 1. Drop Stored Procedure for Online Gateway Reconciliation
DROP FUNCTION IF EXISTS public.reconcile_online_payment(
  p_invoice_id UUID,
  p_amount NUMERIC(12,2),
  p_payment_method VARCHAR(50),
  p_transaction_reference VARCHAR(255),
  p_event_id VARCHAR(255),
  p_provider VARCHAR(50),
  p_webhook_payload JSONB
);

-- 2. Drop Webhook Idempotency & Audit Table for Invoice Webhooks
DROP TABLE IF EXISTS public.payment_webhooks CASCADE;

-- 3. Drop Payment Settings & Webhook Tokens Table
DROP TABLE IF EXISTS public.payment_settings CASCADE;

-- 4. Drop Legacy Business Gateway Configurations Table
DROP TABLE IF EXISTS public.business_gateway_configs CASCADE;

-- ============================================================
-- REVERSIBLE MIGRATION / ROLLBACK INSTRUCTIONS:
-- To restore gateway tables if ever required in the future,
-- re-run migrations:
-- - 20261021000003_online_gateway_foundation.sql
-- - 20261021000004_payment_settings_and_webhook_token.sql
-- ============================================================
