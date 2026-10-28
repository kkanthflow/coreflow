-- Migration: 20261028060000_reconcile_invoice_accounting.sql
-- Description: Authoritative Invoice & Payment Reconciliation, Idempotency, and Accounting Consistency

-- 1. Add idempotency_key and unique constraints to invoice_payments
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_payments_idempotency ON public.invoice_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_payments_submission ON public.invoice_payments(submission_id) WHERE submission_id IS NOT NULL;

-- 2. Establish single authoritative invoice recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_items BOOLEAN;
  v_subtotal NUMERIC(12,2) := 0;
  v_tax_amount NUMERIC(12,2) := 0;
  v_discount_amount NUMERIC(12,2) := 0;
  v_total_amount NUMERIC(12,2) := 0;
  v_paid_amount NUMERIC(12,2) := 0;
  v_balance_due NUMERIC(12,2) := 0;
  v_due_date DATE;
  v_status VARCHAR(50);
  v_current_total NUMERIC(12,2);
  v_current_subtotal NUMERIC(12,2);
  v_current_tax NUMERIC(12,2);
BEGIN
  -- 1. Lock invoice row and fetch current stored parameters
  SELECT discount_amount, due_date, status, total_amount, subtotal, tax_amount
  INTO v_discount_amount, v_due_date, v_status, v_current_total, v_current_subtotal, v_current_tax
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  v_discount_amount := COALESCE(v_discount_amount, 0);

  -- 2. Determine line item totals without erasing invoices that do not have item rows
  SELECT EXISTS(SELECT 1 FROM public.invoice_items WHERE invoice_id = p_invoice_id)
  INTO v_has_items;

  IF v_has_items THEN
    SELECT 
      ROUND(COALESCE(SUM(amount), 0)::NUMERIC, 2),
      ROUND(COALESCE(SUM(tax_amount), 0)::NUMERIC, 2)
    INTO v_subtotal, v_tax_amount
    FROM public.invoice_items
    WHERE invoice_id = p_invoice_id;

    v_total_amount := ROUND((v_subtotal + v_tax_amount - v_discount_amount)::NUMERIC, 2);
    IF v_total_amount < 0 THEN
      v_total_amount := 0;
    END IF;
  ELSE
    -- Preserve existing invoice totals to avoid wiping amounts to zero
    v_subtotal := COALESCE(v_current_subtotal, v_current_total, 0);
    v_tax_amount := COALESCE(v_current_tax, 0);
    v_total_amount := COALESCE(v_current_total, v_subtotal + v_tax_amount - v_discount_amount, 0);
    IF v_total_amount < 0 THEN
      v_total_amount := 0;
    END IF;
  END IF;

  -- 3. Calculate paid amount strictly from invoice_payments authoritative ledger
  SELECT ROUND(COALESCE(SUM(amount), 0)::NUMERIC, 2)
  INTO v_paid_amount
  FROM public.invoice_payments
  WHERE invoice_id = p_invoice_id;

  -- 4. Calculate outstanding balance
  v_balance_due := ROUND(GREATEST(0, v_total_amount - v_paid_amount)::NUMERIC, 2);

  -- 5. Determine consistent authoritative status
  IF v_status = 'cancelled' THEN
    -- Retain cancelled status
  ELSIF v_status = 'draft' AND v_paid_amount = 0 THEN
    -- Retain draft status
  ELSE
    IF v_balance_due <= 0 AND v_total_amount > 0 THEN
      v_status := 'paid';
    ELSIF v_paid_amount > 0 THEN
      v_status := 'partially_paid';
    ELSIF v_due_date IS NOT NULL AND v_due_date < CURRENT_DATE THEN
      v_status := 'overdue';
    ELSE
      v_status := 'sent';
    END IF;
  END IF;

  -- 6. Atomic write
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

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'total_amount', v_total_amount,
    'paid_amount', v_paid_amount,
    'balance_due', v_balance_due,
    'status', v_status
  );
END;
$$;

-- 3. Create idempotent, atomic payment recording RPC
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_method VARCHAR,
  p_transaction_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_received_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inv RECORD;
  v_pmt RECORD;
  v_pmt_id UUID;
BEGIN
  -- 1. Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  -- 2. Check idempotency: If payment with this key already recorded, return existing record
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_pmt
    FROM public.invoice_payments
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      SELECT * INTO v_inv FROM public.invoices WHERE id = v_pmt.invoice_id;
      RETURN jsonb_build_object(
        'success', true,
        'already_recorded', true,
        'payment_id', v_pmt.id,
        'invoice_id', v_inv.id,
        'paid_amount', v_inv.paid_amount,
        'balance_due', v_inv.balance_due,
        'status', v_inv.status
      );
    END IF;
  END IF;

  -- 3. Lock invoice row to serialize concurrent payments
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- 4. Insert into authoritative invoice_payments ledger
  INSERT INTO public.invoice_payments (
    invoice_id,
    amount,
    payment_method,
    transaction_reference,
    notes,
    received_by,
    idempotency_key,
    payment_date,
    currency
  ) VALUES (
    p_invoice_id,
    ROUND(p_amount::NUMERIC, 2),
    p_payment_method,
    p_transaction_reference,
    p_notes,
    p_received_by,
    p_idempotency_key,
    now(),
    v_inv.currency
  )
  RETURNING id INTO v_pmt_id;

  -- 5. Trigger trg_payments_recalculate automatically recalculated invoice totals
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pmt_id,
    'invoice_id', v_inv.id,
    'paid_amount', v_inv.paid_amount,
    'balance_due', v_inv.balance_due,
    'status', v_inv.status
  );
END;
$$;

-- 4. Update confirm_payment_submission to prevent double incrementing
CREATE OR REPLACE FUNCTION public.confirm_payment_submission(
  p_submission_id UUID,
  p_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
  v_inv RECORD;
  v_pmt_id UUID;
BEGIN
  -- 1. Lock submission row
  SELECT * INTO v_sub
  FROM public.payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment submission not found';
  END IF;

  IF v_sub.status != 'pending' THEN
    RAISE EXCEPTION 'Payment submission is already %', v_sub.status;
  END IF;

  -- 2. Lock invoice row
  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = v_sub.invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated invoice not found';
  END IF;

  -- 3. Insert into invoice_payments (trigger trg_payments_recalculate recalculates atomically)
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
    receipt_url,
    submission_id,
    currency
  ) VALUES (
    v_sub.invoice_id,
    ROUND(v_sub.amount::NUMERIC, 2),
    COALESCE(v_sub.payment_date, now()),
    v_sub.payment_method,
    v_sub.transaction_reference,
    v_sub.notes,
    p_staff_id,
    p_staff_id,
    now(),
    v_sub.receipt_url,
    v_sub.id,
    v_sub.currency
  )
  RETURNING id INTO v_pmt_id;

  -- 4. Update submission
  UPDATE public.payment_submissions
  SET
    status = 'confirmed',
    verified_by = p_staff_id,
    verified_at = now(),
    updated_at = now()
  WHERE id = v_sub.id;

  -- 5. Fetch atomically refreshed invoice values
  SELECT * INTO v_inv FROM public.invoices WHERE id = v_sub.invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pmt_id,
    'new_paid', v_inv.paid_amount,
    'new_balance', v_inv.balance_due,
    'new_status', v_inv.status
  );
END;
$$;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION public.record_invoice_payment TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_payment_submission TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals TO authenticated, service_role;

-- 5. Historical Data Reconciliation for Skavelon Technologies
-- Populate line items for INV-381608 (₹2,000) and INV-544320 (₹500) if missing
INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, amount, tax_rate, tax_amount)
SELECT 'db0b6687-9027-4a00-a26e-2467f2424ea3', 'Consulting & Design Services', 1, 2000, 2000, 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_items WHERE invoice_id = 'db0b6687-9027-4a00-a26e-2467f2424ea3'
);

INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, amount, tax_rate, tax_amount)
SELECT '1a3b5c7d-9e1f-4a2b-8c3d-5e7f9a1b3c5d', 'Technical Retainer & Support', 1, 500, 500, 0, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_items WHERE invoice_id = '1a3b5c7d-9e1f-4a2b-8c3d-5e7f9a1b3c5d'
);

-- Audit and reconcile the erroneous 500 cash payment on INV-381608
DO $$
DECLARE
  v_erroneous_pmt RECORD;
  v_ws_id UUID;
BEGIN
  SELECT * INTO v_erroneous_pmt
  FROM public.invoice_payments
  WHERE id = '297315ae-fd82-492f-9707-08a51a2925f6';

  IF FOUND THEN
    SELECT id INTO v_ws_id FROM public.workspaces WHERE name = 'Skavelon Technologies' LIMIT 1;
    
    INSERT INTO public.audit_logs (
      workspace_id,
      actor_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values,
      created_at
    ) VALUES (
      v_ws_id,
      v_erroneous_pmt.received_by,
      'reconcile_erroneous_payment',
      'invoice_payments',
      v_erroneous_pmt.id,
      row_to_json(v_erroneous_pmt)::jsonb,
      jsonb_build_object(
        'reason', 'Erroneous 500 cash payment removed during revenue reconciliation; INV-381608 is 2000 fully paid by 2000 cash payment 66f048f6-9640-414a-b4f9-2d38dd41bf56'
      ),
      now()
    );

    DELETE FROM public.invoice_payments WHERE id = '297315ae-fd82-492f-9707-08a51a2925f6';
  END IF;
END $$;

-- Recalculate invoices
SELECT public.recalculate_invoice_totals('db0b6687-9027-4a00-a26e-2467f2424ea3');
SELECT public.recalculate_invoice_totals('1a3b5c7d-9e1f-4a2b-8c3d-5e7f9a1b3c5d');
