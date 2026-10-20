-- ============================================================
-- AUVRYN Enterprise: Client Invoices RLS, Draft/Cancelled Protection
-- Migration: 20261021000001_client_invoices_rls_and_hiding_drafts.sql
-- ============================================================

-- 1. Invoices RLS: Ensure clients can ONLY view invoices where status is NOT 'draft' or 'cancelled'
DROP POLICY IF EXISTS "Select invoices" ON public.invoices;
CREATE POLICY "Select invoices" ON public.invoices FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      -- Team member / Owner of indie workspace
      (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
      -- Team member of organization with view_invoices permission
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())::uuid) AND
       public.has_permission((select auth.uid())::uuid, 'view_invoices')) OR
      -- Client user: must be linked via clients.user_id OR project_client_access, AND status NOT IN ('draft', 'cancelled')
      (client_id IS NOT NULL AND (
        EXISTS (SELECT 1 FROM public.clients c WHERE c.id = invoices.client_id AND c.user_id = (select auth.uid())::uuid) OR
        EXISTS (SELECT 1 FROM public.project_client_access pca WHERE pca.client_id = invoices.client_id AND pca.user_id = (select auth.uid())::uuid AND pca.status = 'active' AND pca.can_view_financials = true)
      ) AND status NOT IN ('draft', 'cancelled'))
    )
  );

-- 2. Invoice Items RLS: Allow reading line items if parent invoice is visible to user
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Select invoice items" ON public.invoice_items;
CREATE POLICY "Select invoice items" ON public.invoice_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices inv
      WHERE inv.id = invoice_items.invoice_id
    )
  );

-- 3. Invoice Payments RLS: Allow reading payment records if parent invoice is visible to user
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Select invoice payments" ON public.invoice_payments;
CREATE POLICY "Select invoice payments" ON public.invoice_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices inv
      WHERE inv.id = invoice_payments.invoice_id
    )
  );

-- ============================================================
-- REVERSIBLE MIGRATION / ROLLBACK INSTRUCTIONS:
--
-- To rollback:
-- Re-apply policies without the status NOT IN ('draft', 'cancelled') filter.
-- ============================================================
