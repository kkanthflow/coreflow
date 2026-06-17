-- Migration: Fix Database Linter Warnings (RLS and SECURITY DEFINER permissions)
-- Path: d:\projects\coreflow\supabase\migrations\20260614083000_enable_rls_on_roles.sql

-- 1. Enable Row Level Security (RLS) on roles table and add SELECT policy
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select roles" ON public.roles;
CREATE POLICY "Select roles" ON public.roles FOR SELECT TO authenticated
  USING (true);

-- 2. Fix mutable search path for handle_deleted_user
ALTER FUNCTION public.handle_deleted_user() SET search_path = public;

-- 3. Restrict execute permissions for auth trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_deleted_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_deleted_user() TO supabase_auth_admin, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;

-- 4. Change has_permission from SECURITY DEFINER to SECURITY INVOKER
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

-- 5. Restrict execute permissions on internal SECURITY DEFINER functions to prevent RPC execution
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

-- 6. Define policies for tables that have RLS enabled but no policies
DROP POLICY IF EXISTS "Select invoice sequences" ON public.invoice_sequences;
CREATE POLICY "Select invoice sequences" ON public.invoice_sequences FOR SELECT TO authenticated
  USING (
    (owner_id = auth.uid()) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Select taxes" ON public.invoice_taxes;
CREATE POLICY "Select taxes" ON public.invoice_taxes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id));

DROP POLICY IF EXISTS "Insert taxes" ON public.invoice_taxes;
CREATE POLICY "Insert taxes" ON public.invoice_taxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = auth.uid()) OR
    (i.organization_id IS NOT NULL AND public.has_permission(auth.uid(), 'create_invoices'))
  )));

DROP POLICY IF EXISTS "Select receipts" ON public.payment_receipts;
CREATE POLICY "Select receipts" ON public.payment_receipts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice_payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE p.id = payment_id
  ));

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
