-- ============================================================
-- AUVRYN Enterprise: Online Gateway Foundation (Behind Flag)
-- Migration: 20261021000003_online_gateway_foundation.sql
-- ============================================================

-- 1. Table: Business Payment Gateway Configurations
-- Stores per-business merchant credentials and feature flag toggle.
CREATE TABLE IF NOT EXISTS public.business_gateway_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
  is_enabled BOOLEAN NOT NULL DEFAULT false, -- Feature flag defaults to disabled
  key_id TEXT,
  key_secret TEXT,
  webhook_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index & Unique constraint per business and provider
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_gateway_provider
ON public.business_gateway_configs (COALESCE(organization_id, owner_id), provider);

-- 2. Table: Payment Webhooks Ledger (Idempotency & Audit)
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL UNIQUE, -- Idempotency key
  provider VARCHAR(50) NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  owner_id UUID REFERENCES public.users(id),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'processed' CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  invoice_id UUID REFERENCES public.invoices(id),
  payment_id UUID REFERENCES public.invoice_payments(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_event ON public.payment_webhooks(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_invoice ON public.payment_webhooks(invoice_id);

-- 3. Enable RLS
ALTER TABLE public.business_gateway_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;

-- Gateway Configs RLS: Only business owner or admin can view/manage their secrets
DROP POLICY IF EXISTS "Manage business gateway configs" ON public.business_gateway_configs;
CREATE POLICY "Manage business gateway configs" ON public.business_gateway_configs
FOR ALL TO authenticated
USING (
  (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
  (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = business_gateway_configs.organization_id AND uo.user_id = (select auth.uid())::uuid AND (
      uo.role IN ('owner', 'administrator') OR public.has_permission((select auth.uid())::uuid, 'record_payments')
    )
  ))
);

-- Payment Webhooks RLS: Staff can view webhook audit logs
DROP POLICY IF EXISTS "Select payment webhooks" ON public.payment_webhooks;
CREATE POLICY "Select payment webhooks" ON public.payment_webhooks
FOR SELECT TO authenticated
USING (
  (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
  (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = payment_webhooks.organization_id AND uo.user_id = (select auth.uid())::uuid
  ))
);

-- 4. Atomic Stored Procedure: Reconcile Online Gateway Payment
-- Handles payment recording idempotently
CREATE OR REPLACE FUNCTION public.reconcile_online_payment(
  p_invoice_id UUID,
  p_amount NUMERIC(12,2),
  p_payment_method VARCHAR(50),
  p_transaction_reference VARCHAR(255),
  p_event_id VARCHAR(255),
  p_provider VARCHAR(50),
  p_webhook_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
  v_new_paid NUMERIC(12,2);
  v_new_bal NUMERIC(12,2);
  v_new_status VARCHAR(50);
  v_pmt_id UUID;
  v_webhook_id UUID;
BEGIN
  -- 1. Check idempotency: if event_id already processed, return existing
  IF p_event_id IS NOT NULL THEN
    SELECT id, payment_id INTO v_webhook_id, v_pmt_id
    FROM public.payment_webhooks
    WHERE event_id = p_event_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'payment_id', v_pmt_id
      );
    END IF;
  END IF;

  -- 2. Lock invoice row
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- 3. Calculate new balance
  v_new_paid := COALESCE(v_inv.paid_amount, 0) + p_amount;
  v_new_bal := GREATEST(0, v_inv.total_amount - v_new_paid);
  IF v_new_bal <= 0 THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  -- 4. Create invoice_payments entry
  INSERT INTO public.invoice_payments (
    invoice_id,
    amount,
    payment_date,
    payment_method,
    transaction_reference,
    notes,
    received_by,
    confirmed_by,
    confirmed_at,
    currency
  ) VALUES (
    v_inv.id,
    p_amount,
    CURRENT_DATE,
    p_payment_method,
    p_transaction_reference,
    format('Online gateway clearance via %s', p_provider),
    v_inv.owner_id,
    v_inv.owner_id,
    now(),
    v_inv.currency
  )
  RETURNING id INTO v_pmt_id;

  -- 5. Update invoice
  UPDATE public.invoices
  SET
    paid_amount = v_new_paid,
    balance_due = v_new_bal,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_inv.id;

  -- 6. Record in payment_webhooks ledger for idempotency
  IF p_event_id IS NOT NULL THEN
    INSERT INTO public.payment_webhooks (
      event_id,
      provider,
      organization_id,
      owner_id,
      event_type,
      payload,
      status,
      invoice_id,
      payment_id,
      processed_at
    ) VALUES (
      p_event_id,
      p_provider,
      v_inv.organization_id,
      v_inv.owner_id,
      'payment.captured',
      COALESCE(p_webhook_payload, '{}'::jsonb),
      'processed',
      v_inv.id,
      v_pmt_id,
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pmt_id,
    'new_paid', v_new_paid,
    'new_balance', v_new_bal,
    'new_status', v_new_status
  );
END;
$$;

-- ============================================================
-- REVERSIBLE MIGRATION / ROLLBACK INSTRUCTIONS:
--
-- To rollback:
-- DROP FUNCTION IF EXISTS public.reconcile_online_payment;
-- DROP TABLE IF EXISTS public.payment_webhooks;
-- DROP TABLE IF EXISTS public.business_gateway_configs;
-- ============================================================
