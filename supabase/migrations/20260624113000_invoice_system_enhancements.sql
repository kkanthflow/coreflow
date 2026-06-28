-- 1. Add GST and address columns to organizations table
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Update recalculate_invoice_totals function to move invoices out of 'draft' status automatically
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

  -- Active status resolution (no sticky draft status)
  IF v_status = 'cancelled' THEN
    -- keep cancelled
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

NOTIFY pgrst, 'reload schema';
