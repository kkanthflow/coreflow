-- Migration: Index unindexed foreign keys to resolve database linter INFO warnings
-- Path: supabase/migrations/20260616150000_add_foreign_key_indexes.sql

-- 1. Table: public.activity_feed
CREATE INDEX IF NOT EXISTS idx_activity_feed_related_meeting_id 
  ON public.activity_feed(related_meeting_id);

CREATE INDEX IF NOT EXISTS idx_activity_feed_related_user_id 
  ON public.activity_feed(related_user_id);


-- 2. Table: public.bill_references
CREATE INDEX IF NOT EXISTS idx_bill_references_organization_id 
  ON public.bill_references(organization_id);

CREATE INDEX IF NOT EXISTS idx_bill_references_owner_id 
  ON public.bill_references(owner_id);

CREATE INDEX IF NOT EXISTS idx_bill_references_uploaded_by 
  ON public.bill_references(uploaded_by);


-- 3. Table: public.clients
CREATE INDEX IF NOT EXISTS idx_clients_created_by 
  ON public.clients(created_by);

CREATE INDEX IF NOT EXISTS idx_clients_deleted_by 
  ON public.clients(deleted_by);


-- 4. Table: public.invoice_audit_logs
CREATE INDEX IF NOT EXISTS idx_invoice_audit_logs_organization_id 
  ON public.invoice_audit_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_invoice_audit_logs_user_id 
  ON public.invoice_audit_logs(user_id);


-- 5. Table: public.invoice_items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id 
  ON public.invoice_items(invoice_id);


-- 6. Table: public.invoice_payments
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id 
  ON public.invoice_payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_received_by 
  ON public.invoice_payments(received_by);


-- 7. Table: public.invoice_taxes
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_invoice_id 
  ON public.invoice_taxes(invoice_id);


-- 8. Table: public.invoices
CREATE INDEX IF NOT EXISTS idx_invoices_bill_reference_id 
  ON public.invoices(bill_reference_id);

CREATE INDEX IF NOT EXISTS idx_invoices_creator_id 
  ON public.invoices(creator_id);

CREATE INDEX IF NOT EXISTS idx_invoices_deleted_by 
  ON public.invoices(deleted_by);


-- 9. Table: public.meetings
CREATE INDEX IF NOT EXISTS idx_meetings_parent_meeting_id 
  ON public.meetings(parent_meeting_id);


-- 10. Table: public.notifications
CREATE INDEX IF NOT EXISTS idx_notifications_related_meeting_id 
  ON public.notifications(related_meeting_id);


-- 11. Table: public.payment_receipts
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_id 
  ON public.payment_receipts(payment_id);
