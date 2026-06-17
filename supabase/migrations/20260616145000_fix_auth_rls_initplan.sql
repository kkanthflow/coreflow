-- Migration: Fix auth_rls_initplan and multiple_permissive_policies linter warnings
-- Path: supabase/migrations/20260616145000_fix_auth_rls_initplan.sql

-- =======================================================================
-- 1. Table: public.users
-- =======================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Select users" ON public.users;
CREATE POLICY "Select users" ON public.users FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Only admins can change user roles" ON public.users;
DROP POLICY IF EXISTS "Admins can soft-delete users" ON public.users;
DROP POLICY IF EXISTS "Update users" ON public.users;
CREATE POLICY "Update users" ON public.users FOR UPDATE TO authenticated
  USING (
    (select auth.uid())::text = id::text OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  )
  WITH CHECK (
    (select auth.uid())::text = id::text OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );


-- =======================================================================
-- 2. Table: public.jwt_tokens
-- =======================================================================
DROP POLICY IF EXISTS "Users can view own tokens" ON public.jwt_tokens;
CREATE POLICY "Users can view own tokens" ON public.jwt_tokens FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can revoke own tokens" ON public.jwt_tokens;
CREATE POLICY "Users can revoke own tokens" ON public.jwt_tokens FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));


-- =======================================================================
-- 3. Table: public.meetings
-- =======================================================================
DROP POLICY IF EXISTS "Users can view own meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view invited meetings" ON public.meetings;
DROP POLICY IF EXISTS "Users can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Select meetings" ON public.meetings;
CREATE POLICY "Select meetings" ON public.meetings FOR SELECT TO authenticated
  USING (
    creator_id = (select auth.uid()) OR 
    private.check_is_attendee(id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Users can create meetings" ON public.meetings;
CREATE POLICY "Users can create meetings" ON public.meetings FOR INSERT TO authenticated
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own meetings" ON public.meetings;
CREATE POLICY "Users can update own meetings" ON public.meetings FOR UPDATE TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own meetings" ON public.meetings;
CREATE POLICY "Users can delete own meetings" ON public.meetings FOR DELETE TO authenticated
  USING (creator_id = (select auth.uid()));


-- =======================================================================
-- 4. Table: public.meeting_attendees
-- =======================================================================
DROP POLICY IF EXISTS "Users can see attendees of their meetings" ON public.meeting_attendees;
DROP POLICY IF EXISTS "Users can view meeting attendees" ON public.meeting_attendees;
DROP POLICY IF EXISTS "Select meeting attendees" ON public.meeting_attendees;
CREATE POLICY "Select meeting attendees" ON public.meeting_attendees FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = (select auth.uid())
    ) OR
    private.check_is_attendee(meeting_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Meeting creators can add attendees" ON public.meeting_attendees;
CREATE POLICY "Meeting creators can add attendees" ON public.meeting_attendees FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own RSVP" ON public.meeting_attendees;
CREATE POLICY "Users can update own RSVP" ON public.meeting_attendees FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Meeting creators can remove attendees" ON public.meeting_attendees;
CREATE POLICY "Meeting creators can remove attendees" ON public.meeting_attendees FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = (select auth.uid())
    )
  );


-- =======================================================================
-- 5. Table: public.role_change_audit
-- =======================================================================
DROP POLICY IF EXISTS "Only admins can view role audit" ON public.role_change_audit;
CREATE POLICY "Only admins can view role audit" ON public.role_change_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

DROP POLICY IF EXISTS "Only admins can create role audit" ON public.role_change_audit;
CREATE POLICY "Only admins can create role audit" ON public.role_change_audit FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );


-- =======================================================================
-- 6. Table: public.notifications
-- =======================================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));


-- =======================================================================
-- 7. Table: public.test_accounts
-- =======================================================================
DROP POLICY IF EXISTS "Only admins can view test accounts" ON public.test_accounts;
CREATE POLICY "Only admins can view test accounts" ON public.test_accounts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

DROP POLICY IF EXISTS "Only admins can delete test accounts" ON public.test_accounts;
CREATE POLICY "Only admins can delete test accounts" ON public.test_accounts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid())
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );


-- =======================================================================
-- 8. Table: public.activity_feed
-- =======================================================================
DROP POLICY IF EXISTS "Users can create activity feed" ON public.activity_feed;
CREATE POLICY "Users can create activity feed" ON public.activity_feed FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));


-- =======================================================================
-- 9. Table: public.user_organizations
-- =======================================================================
DROP POLICY IF EXISTS "Users can see other members in their orgs" ON public.user_organizations;
DROP POLICY IF EXISTS "Users can view their own org memberships" ON public.user_organizations;
DROP POLICY IF EXISTS "Select user organizations" ON public.user_organizations;
CREATE POLICY "Select user organizations" ON public.user_organizations FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR private.is_org_member(org_id)
  );

DROP POLICY IF EXISTS "Users can join an org or be added" ON public.user_organizations;
CREATE POLICY "Users can join an org or be added" ON public.user_organizations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) OR private.is_org_member(org_id)
  );


-- =======================================================================
-- 10. Table: public.clients
-- =======================================================================
DROP POLICY IF EXISTS "Select clients" ON public.clients;
CREATE POLICY "Select clients" ON public.clients FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = (select auth.uid())) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
       public.has_permission((select auth.uid()), 'view_invoices'))
    )
  );

DROP POLICY IF EXISTS "Insert clients" ON public.clients;
CREATE POLICY "Insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_clients'))
  );

DROP POLICY IF EXISTS "Update clients" ON public.clients;
CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_clients'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_clients'))
  );

DROP POLICY IF EXISTS "Delete clients" ON public.clients;
CREATE POLICY "Delete clients" ON public.clients FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_clients'))
  );


-- =======================================================================
-- 11. Table: public.user_preferences
-- =======================================================================
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);


-- =======================================================================
-- 12. Table: public.organizations
-- =======================================================================
DROP POLICY IF EXISTS "Any authenticated user can create an org" ON public.organizations;
CREATE POLICY "Any authenticated user can create an org" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');


-- =======================================================================
-- 13. Table: public.invoices
-- =======================================================================
DROP POLICY IF EXISTS "Select invoices" ON public.invoices;
CREATE POLICY "Select invoices" ON public.invoices FOR SELECT TO authenticated
  USING (
    (is_deleted = FALSE) AND (
      (organization_id IS NULL AND owner_id = (select auth.uid())) OR
      (organization_id IS NOT NULL AND 
       EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
       public.has_permission((select auth.uid()), 'view_invoices'))
    )
  );

DROP POLICY IF EXISTS "Insert invoices" ON public.invoices;
CREATE POLICY "Insert invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'create_invoices'))
  );

DROP POLICY IF EXISTS "Update invoices" ON public.invoices;
CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'edit_invoices'))
  )
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'edit_invoices'))
  );

DROP POLICY IF EXISTS "Delete invoices" ON public.invoices;
CREATE POLICY "Delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'delete_invoices'))
  );


-- =======================================================================
-- 14. Table: public.bill_references
-- =======================================================================
DROP POLICY IF EXISTS "Select bill references" ON public.bill_references;
CREATE POLICY "Select bill references" ON public.bill_references FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'view_invoices'))
  );

DROP POLICY IF EXISTS "Insert bill references" ON public.bill_references;
CREATE POLICY "Insert bill references" ON public.bill_references FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NULL AND owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'manage_bill_references'))
  );


-- =======================================================================
-- 15. Table: public.invoice_items
-- =======================================================================
DROP POLICY IF EXISTS "Insert items" ON public.invoice_items;
CREATE POLICY "Insert items" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid()), 'create_invoices'))
  )));


-- =======================================================================
-- 16. Table: public.invoice_payments
-- =======================================================================
DROP POLICY IF EXISTS "Insert payments" ON public.invoice_payments;
CREATE POLICY "Insert payments" ON public.invoice_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid()), 'record_payments'))
  )));


-- =======================================================================
-- 17. Table: public.invoice_sequences
-- =======================================================================
DROP POLICY IF EXISTS "Select invoice sequences" ON public.invoice_sequences;
CREATE POLICY "Select invoice sequences" ON public.invoice_sequences FOR SELECT TO authenticated
  USING (
    (owner_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())))
  );


-- =======================================================================
-- 18. Table: public.invoice_taxes
-- =======================================================================
DROP POLICY IF EXISTS "Insert taxes" ON public.invoice_taxes;
CREATE POLICY "Insert taxes" ON public.invoice_taxes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND (
    (i.organization_id IS NULL AND i.owner_id = (select auth.uid())) OR
    (i.organization_id IS NOT NULL AND public.has_permission((select auth.uid()), 'create_invoices'))
  )));


-- =======================================================================
-- 19. Table: public.invoice_audit_logs
-- =======================================================================
DROP POLICY IF EXISTS "Select audit logs" ON public.invoice_audit_logs;
CREATE POLICY "Select audit logs" ON public.invoice_audit_logs FOR SELECT TO authenticated
  USING (
    (organization_id IS NULL AND user_id = (select auth.uid())) OR
    (organization_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM public.user_organizations WHERE org_id = organization_id AND user_id = (select auth.uid())) AND
     public.has_permission((select auth.uid()), 'view_audit_log'))
  );


-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
