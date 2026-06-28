-- Recreate RLS Policies on invoices, invoice_items, and invoice_payments to support full CRUD operations

-- 1. INVOICES POLICIES
DROP POLICY IF EXISTS "Select invoices" ON public.invoices;
CREATE POLICY "Select invoices" ON public.invoices FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())::uuid) AND
     public.has_permission((select auth.uid())::uuid, 'view_invoices'))
  );

DROP POLICY IF EXISTS "Insert invoices" ON public.invoices;
CREATE POLICY "Insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())::uuid) AND
     public.has_permission((select auth.uid())::uuid, 'create_invoices'))
  );

DROP POLICY IF EXISTS "Update invoices" ON public.invoices;
CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())::uuid) AND
     public.has_permission((select auth.uid())::uuid, 'edit_invoices'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())::uuid) AND
     public.has_permission((select auth.uid())::uuid, 'edit_invoices'))
  );

DROP POLICY IF EXISTS "Delete invoices" ON public.invoices;
CREATE POLICY "Delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())::uuid) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())::uuid) AND
     public.has_permission((select auth.uid())::uuid, 'delete_invoices'))
  );


-- 2. INVOICE ITEMS POLICIES
DROP POLICY IF EXISTS "Select items" ON public.invoice_items;
CREATE POLICY "Select items" ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

DROP POLICY IF EXISTS "Insert items" ON public.invoice_items;
CREATE POLICY "Insert items" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())::uuid) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid())::uuid, 'create_invoices'))
  )));

DROP POLICY IF EXISTS "Update items" ON public.invoice_items;
CREATE POLICY "Update items" ON public.invoice_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())::uuid) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid())::uuid, 'edit_invoices'))
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())::uuid) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid())::uuid, 'edit_invoices'))
  )));

DROP POLICY IF EXISTS "Delete items" ON public.invoice_items;
CREATE POLICY "Delete items" ON public.invoice_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())::uuid) OR
    (i.organization_id IS NOT NULL AND (
      public.has_permission((select auth.uid())::uuid, 'edit_invoices') OR 
      public.has_permission((select auth.uid())::uuid, 'delete_invoices')
    ))
  )));


-- 3. INVOICE PAYMENTS POLICIES
DROP POLICY IF EXISTS "Select payments" ON public.invoice_payments;
CREATE POLICY "Select payments" ON public.invoice_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

DROP POLICY IF EXISTS "Insert payments" ON public.invoice_payments;
CREATE POLICY "Insert payments" ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())::uuid) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid())::uuid, 'record_payments'))
  )));

DROP POLICY IF EXISTS "Update payments" ON public.invoice_payments;
CREATE POLICY "Update payments" ON public.invoice_payments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())::uuid) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid())::uuid, 'record_payments'))
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())::uuid) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid())::uuid, 'record_payments'))
  )));

DROP POLICY IF EXISTS "Delete payments" ON public.invoice_payments;
CREATE POLICY "Delete payments" ON public.invoice_payments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())::uuid) OR
    (i.organization_id IS NOT NULL AND (
      public.has_permission((select auth.uid())::uuid, 'record_payments') OR 
      public.has_permission((select auth.uid())::uuid, 'delete_invoices')
    ))
  )));

NOTIFY pgrst, 'reload schema';
