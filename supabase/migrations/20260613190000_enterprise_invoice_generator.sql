-- Migration: Setup Enterprise Invoice Generator System
-- Path: d:\projects\coreflow\supabase\migrations\20260613190000_enterprise_invoice_generator.sql

-- 1. Create Roles & Permissions Table
CREATE TABLE IF NOT EXISTS public.roles (
  role_name VARCHAR(50) PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Populate Default Role Permissions
INSERT INTO public.roles (role_name, permissions) VALUES
('managing_director', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "manage_roles", "view_audit_log", "manage_test_accounts", "schedule_meetings", "view_team_directory"]'::jsonb),
('ceo', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "manage_roles", "view_audit_log", "manage_test_accounts", "schedule_meetings", "view_team_directory"]'::jsonb),
('cto', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "manage_roles", "view_audit_log", "manage_test_accounts", "schedule_meetings", "view_team_directory"]'::jsonb),
('project_manager', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "schedule_meetings", "view_team_directory"]'::jsonb),
('hr', '["view_invoices", "schedule_meetings", "view_team_directory"]'::jsonb),
('developer', '["schedule_meetings", "view_team_directory"]'::jsonb),
('general_member', '["schedule_meetings", "view_team_directory"]'::jsonb),
('freelancer', '["view_invoices", "create_invoices", "edit_invoices", "delete_invoices", "record_payments", "manage_clients", "manage_bill_references", "generate_invoice_pdfs", "schedule_meetings", "view_team_directory"]'::jsonb)
ON CONFLICT (role_name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- 2. Create Dynamic SQL Permission Checker
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR(50);
  v_has BOOLEAN;
BEGIN
  SELECT role::VARCHAR INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT (permissions ? p_permission) INTO v_has
  FROM public.roles
  WHERE role_name = v_role;
  RETURN COALESCE(v_has, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 3. Create Sequences Table
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_sequence INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, year),
  CONSTRAINT unique_owner_year_freelancer UNIQUE (owner_id, year)
);

-- 4. Create Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  gst_number VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Bill References Table
CREATE TABLE IF NOT EXISTS public.bill_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_bucket VARCHAR(100) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB DEFAULT '{}'::jsonb,
  ocr_provider VARCHAR(50),
  ocr_confidence NUMERIC,
  ocr_processed_at TIMESTAMP WITH TIME ZONE,
  extraction_version VARCHAR(20),
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE,
  client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT,
  bill_reference_id UUID REFERENCES public.bill_references(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  issue_date DATE DEFAULT CURRENT_DATE NOT NULL,
  due_date DATE NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  base_currency VARCHAR(10) DEFAULT 'INR',
  exchange_rate NUMERIC DEFAULT 1,
  exchange_rate_date DATE,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency VARCHAR(50),
  next_run_date DATE,
  last_generated_at TIMESTAMP WITH TIME ZONE,
  recurring_end_date DATE,
  recurring_active BOOLEAN DEFAULT TRUE,
  template_style VARCHAR(50) DEFAULT 'classic',
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Create Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  rate NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  hsn_code VARCHAR(50),
  sac_code VARCHAR(50),
  unit VARCHAR(20) DEFAULT 'units',
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  amount NUMERIC NOT NULL
);

-- 8. Create Invoice Taxes Table
CREATE TABLE IF NOT EXISTS public.invoice_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tax_name VARCHAR(50) NOT NULL,
  tax_rate NUMERIC NOT NULL,
  tax_amount NUMERIC NOT NULL
);

-- 9. Create Invoice Payments Table
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(100),
  transaction_reference TEXT,
  received_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Create Payment Receipts Table
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.invoice_payments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(100) UNIQUE NOT NULL,
  pdf_url TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Create Invoice Audit Logs Table
CREATE TABLE IF NOT EXISTS public.invoice_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_owner ON public.invoices(owner_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_num ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_deleted ON public.invoices(is_deleted);

CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clients_owner ON public.clients(owner_id) WHERE is_deleted = FALSE;

-- 12. Transactional Sequence Generator Function
CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(
  p_org_id UUID,
  p_owner_id UUID,
  p_year INTEGER
)
RETURNS VARCHAR AS $$
DECLARE
  v_seq_record RECORD;
  v_next_seq INTEGER;
  v_num VARCHAR;
BEGIN
  IF p_org_id IS NOT NULL THEN
    INSERT INTO public.invoice_sequences (organization_id, owner_id, year, last_sequence)
    VALUES (p_org_id, p_owner_id, p_year, 0)
    ON CONFLICT (organization_id, year) DO NOTHING;
    
    SELECT * INTO v_seq_record
    FROM public.invoice_sequences
    WHERE organization_id = p_org_id AND year = p_year
    FOR UPDATE;
  ELSE
    INSERT INTO public.invoice_sequences (organization_id, owner_id, year, last_sequence)
    VALUES (NULL, p_owner_id, p_year, 0)
    ON CONFLICT (owner_id, year) DO NOTHING;
    
    SELECT * INTO v_seq_record
    FROM public.invoice_sequences
    WHERE organization_id IS NULL AND owner_id = p_owner_id AND year = p_year
    FOR UPDATE;
  END IF;

  v_next_seq := v_seq_record.last_sequence + 1;

  UPDATE public.invoice_sequences
  SET last_sequence = v_next_seq
  WHERE id = v_seq_record.id;

  v_num := 'CF-' || p_year::TEXT || '-' || lpad(v_next_seq::TEXT, 5, '0');
  RETURN v_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Set invoice number before insert trigger
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM COALESCE(NEW.issue_date, CURRENT_DATE))::INTEGER;
  NEW.invoice_number := public.generate_next_invoice_number(NEW.organization_id, NEW.owner_id, v_year);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_set_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.set_invoice_number();

-- 13. Dynamic Invoice Totals Recalculation Engine
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

  IF v_status = 'cancelled' THEN
    -- keep cancelled
  ELSIF v_status = 'draft' THEN
    IF v_paid_amount > 0 THEN
      IF v_balance_due = 0 THEN
        v_status := 'paid';
      ELSE
        v_status := 'partially_paid';
      END IF;
    END IF;
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

-- Recalculation triggers on item and payment changes
CREATE OR REPLACE FUNCTION public.trg_recalculate_invoice_items()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_invoice_totals(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_invoice_totals(NEW.invoice_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_items_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_invoice_items();

CREATE OR REPLACE TRIGGER trg_payments_recalculate
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_invoice_items();

-- Automatic receipt generation trigger
CREATE OR REPLACE FUNCTION public.trg_generate_payment_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_rec_num VARCHAR;
BEGIN
  v_rec_num := 'REC-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || lpad(floor(random() * 1000000)::TEXT, 6, '0');
  INSERT INTO public.payment_receipts (payment_id, receipt_number, pdf_url)
  VALUES (NEW.id, v_rec_num, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER trg_create_receipt
  AFTER INSERT ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_generate_payment_receipt();

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_audit_logs ENABLE ROW LEVEL SECURITY;

-- 14. Row-Level Security Policies
-- SELECT, INSERT, UPDATE, DELETE policies for clients
CREATE POLICY "Select clients" ON public.clients FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = auth.uid()) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
       public.has_permission(auth.uid(), 'view_invoices'))
    )
  );

CREATE POLICY "Insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_clients'))
  );

CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_clients'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_clients'))
  );

CREATE POLICY "Delete clients" ON public.clients FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_clients'))
  );

-- SELECT, INSERT, UPDATE, DELETE policies for invoices
CREATE POLICY "Select invoices" ON public.invoices FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = auth.uid()) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
       public.has_permission(auth.uid(), 'view_invoices'))
    )
  );

CREATE POLICY "Insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'create_invoices'))
  );

CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'edit_invoices'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'edit_invoices'))
  );

CREATE POLICY "Delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'delete_invoices'))
  );

-- SELECT, INSERT, UPDATE, DELETE policies for bill references
CREATE POLICY "Select bill references" ON public.bill_references FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'view_invoices'))
  );

CREATE POLICY "Insert bill references" ON public.bill_references FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'manage_bill_references'))
  );

-- Enable access to child tables if parent invoice is readable
CREATE POLICY "Select items" ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

CREATE POLICY "Insert items" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = auth.uid()) OR
    (i.organization_id IS NOT NULL AND public.has_permission(auth.uid(), 'create_invoices'))
  )));

CREATE POLICY "Select payments" ON public.invoice_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

CREATE POLICY "Insert payments" ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = auth.uid()) OR
    (i.organization_id IS NOT NULL AND public.has_permission(auth.uid(), 'record_payments'))
  )));

-- Policies for invoice_sequences
CREATE POLICY "Select invoice sequences" ON public.invoice_sequences FOR SELECT TO authenticated
  USING (
    (owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()))
  );

-- Policies for invoice_taxes
CREATE POLICY "Select taxes" ON public.invoice_taxes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

CREATE POLICY "Insert taxes" ON public.invoice_taxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = auth.uid()) OR
    (i.organization_id IS NOT NULL AND public.has_permission(auth.uid(), 'create_invoices'))
  )));

-- Policies for payment_receipts
CREATE POLICY "Select receipts" ON public.payment_receipts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice_payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE p.id = payment_id
  ));

-- Allow view access to audit logs for managers/freelancers
CREATE POLICY "Select audit logs" ON public.invoice_audit_logs FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND user_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()) AND
     public.has_permission(auth.uid(), 'view_audit_log'))
  );

-- SELECT policy for roles table
CREATE POLICY "Select roles" ON public.roles FOR SELECT TO authenticated
  USING (true);

-- Restrict execute permissions on internal SECURITY DEFINER functions to prevent RPC execution
REVOKE EXECUTE ON FUNCTION public.generate_next_invoice_number(UUID, UUID, INTEGER) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_invoice_number() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_generate_payment_receipt() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalculate_invoice_items() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_next_invoice_number(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_invoice_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_generate_payment_receipt() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_recalculate_invoice_items() TO service_role;
