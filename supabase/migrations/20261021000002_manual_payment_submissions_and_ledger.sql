-- ============================================================
-- AUVRYN Enterprise: Manual Payment Submissions & Ledger
-- Migration: 20261021000002_manual_payment_submissions_and_ledger.sql
-- ============================================================

-- 1. Create storage bucket for payment receipts if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment_receipts',
  'payment_receipts',
  false,
  5242880, -- 5 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 2. Storage RLS policies for payment_receipts bucket
DROP POLICY IF EXISTS "Authenticated users can upload payment receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload payment receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment_receipts');

DROP POLICY IF EXISTS "Users can read payment receipts" ON storage.objects;
CREATE POLICY "Users can read payment receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment_receipts');

-- 3. Create public.payment_submissions table
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.users(id),
  organization_id UUID REFERENCES public.organizations(id),
  owner_id UUID NOT NULL REFERENCES public.users(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  transaction_reference VARCHAR(255),
  notes TEXT,
  receipt_url TEXT NOT NULL,
  receipt_filename VARCHAR(255),
  receipt_mime VARCHAR(50),
  receipt_size_bytes INT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  rejection_reason TEXT,
  verified_by UUID REFERENCES public.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for invoice lookups and status filtering
CREATE INDEX IF NOT EXISTS idx_payment_submissions_invoice ON public.payment_submissions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON public.payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_org ON public.payment_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_client ON public.payment_submissions(client_id);

-- Unique index to prevent duplicate transaction reference within same business
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_payment_submission_ref 
ON public.payment_submissions (COALESCE(organization_id, owner_id), LOWER(TRIM(transaction_reference))) 
WHERE transaction_reference IS NOT NULL AND status != 'rejected';

-- 4. Extend public.invoice_payments for immutable ledger auditing
ALTER TABLE public.invoice_payments
ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES public.payment_submissions(id),
ADD COLUMN IF NOT EXISTS receipt_url TEXT,
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 5. Enable RLS on payment_submissions
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select payment submissions" ON public.payment_submissions;
CREATE POLICY "Select payment submissions" ON public.payment_submissions FOR SELECT TO authenticated
USING (
  -- Business staff/owner can view submissions for their organization or workspace
  (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
  (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = payment_submissions.organization_id AND uo.user_id = (select auth.uid())::uuid
  )) OR
  -- Client can view submissions they submitted or linked to their client account
  (submitted_by = (select auth.uid())::uuid) OR
  (client_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = payment_submissions.client_id AND c.user_id = (select auth.uid())::uuid
  ))
);

DROP POLICY IF EXISTS "Insert payment submissions" ON public.payment_submissions;
CREATE POLICY "Insert payment submissions" ON public.payment_submissions FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = (select auth.uid())::uuid AND
  EXISTS (
    SELECT 1 FROM public.invoices inv
    WHERE inv.id = payment_submissions.invoice_id
  )
);

DROP POLICY IF EXISTS "Update payment submissions" ON public.payment_submissions;
CREATE POLICY "Update payment submissions" ON public.payment_submissions FOR UPDATE TO authenticated
USING (
  -- Only staff with record_payments or owner/admin can update submissions (to confirm or reject)
  (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
  (organization_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = payment_submissions.organization_id AND uo.user_id = (select auth.uid())::uuid AND (
        public.has_permission((select auth.uid())::uuid, 'record_payments') OR uo.role IN ('owner', 'administrator')
      )
    )
  ))
);

-- 6. Atomic Stored Procedure: Confirm Payment Submission
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
  v_new_paid NUMERIC(12,2);
  v_new_bal NUMERIC(12,2);
  v_new_status VARCHAR(50);
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

  -- 3. Calculate new totals
  v_new_paid := COALESCE(v_inv.paid_amount, 0) + v_sub.amount;
  v_new_bal := GREATEST(0, v_inv.total_amount - v_new_paid);
  IF v_new_bal <= 0 THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  -- 4. Create immutable entry in invoice_payments
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
    v_sub.amount,
    v_sub.payment_date,
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

  -- 5. Update invoice
  UPDATE public.invoices
  SET
    paid_amount = v_new_paid,
    balance_due = v_new_bal,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_inv.id;

  -- 6. Update submission
  UPDATE public.payment_submissions
  SET
    status = 'confirmed',
    verified_by = p_staff_id,
    verified_at = now(),
    updated_at = now()
  WHERE id = v_sub.id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pmt_id,
    'new_paid', v_new_paid,
    'new_balance', v_new_bal,
    'new_status', v_new_status
  );
END;
$$;

-- 7. Atomic Stored Procedure: Reject Payment Submission
CREATE OR REPLACE FUNCTION public.reject_payment_submission(
  p_submission_id UUID,
  p_staff_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sub RECORD;
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

  -- 2. Update submission
  UPDATE public.payment_submissions
  SET
    status = 'rejected',
    rejection_reason = p_reason,
    verified_by = p_staff_id,
    verified_at = now(),
    updated_at = now()
  WHERE id = v_sub.id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'rejected'
  );
END;
$$;

-- ============================================================
-- REVERSIBLE MIGRATION / ROLLBACK INSTRUCTIONS:
--
-- To rollback:
-- DROP FUNCTION IF EXISTS public.reject_payment_submission(UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.confirm_payment_submission(UUID, UUID);
-- DROP TABLE IF EXISTS public.payment_submissions;
-- ALTER TABLE public.invoice_payments DROP COLUMN IF EXISTS confirmed_at;
-- ALTER TABLE public.invoice_payments DROP COLUMN IF EXISTS confirmed_by;
-- ALTER TABLE public.invoice_payments DROP COLUMN IF EXISTS receipt_url;
-- ALTER TABLE public.invoice_payments DROP COLUMN IF EXISTS submission_id;
-- ============================================================
