-- ==============================================================================
-- AUVRYN — Enterprise Role Limitations & Security Rules Migration
-- Migration: 20261027140000_enterprise_role_limitations_and_security_rules.sql
--
-- Enforces:
-- 1. Strict separation of Job Titles vs Application Roles & Permissions.
-- 2. Principle of least privilege (default-deny).
-- 3. Tenant isolation on every query & operation.
-- 4. Scope-based permissions: organization, department, project, assigned, client.
-- 5. Granular action restrictions (view, create, update, delete, approve, download, billing, security).
-- 6. Anti-privilege escalation on custom roles.
-- 7. Last-owner retention and secure ownership transfer.
-- 8. Client-to-client isolation (clients only see their approved records).
-- 9. Immutable audit logging for security and compliance.
-- 10. Real-time access revocation across all modules.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURE OWNERSHIP TRANSFER RPC
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.transfer_organization_ownership(
  p_org_id uuid,
  p_new_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_current_owner_id uuid;
  v_new_owner_email text;
  v_org_name text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- 1. Verify caller is currently the primary owner
  SELECT owner_id, name INTO v_current_owner_id, v_org_name 
  FROM public.organizations 
  WHERE id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'Security error: Only the current organization owner can transfer ownership.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate target user
  IF p_new_owner_id IS NULL OR p_new_owner_id = v_caller_id THEN
    RAISE EXCEPTION 'Validation error: A different active organization member must be designated as the new owner.' USING ERRCODE = '22023';
  END IF;

  -- Verify target user is an active member
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations 
    WHERE org_id = p_org_id AND user_id = p_new_owner_id
  ) THEN
    RAISE EXCEPTION 'Validation error: Target user is not an active member of this organization.' USING ERRCODE = 'P0002';
  END IF;

  SELECT email INTO v_new_owner_email FROM public.users WHERE id = p_new_owner_id;

  -- 3. Atomic transfer
  -- Update organization owner
  UPDATE public.organizations
  SET owner_id = p_new_owner_id
  WHERE id = p_org_id;

  -- Update new owner membership role to 'owner'
  UPDATE public.user_organizations
  SET role = 'owner', custom_role_id = NULL
  WHERE org_id = p_org_id AND user_id = p_new_owner_id;

  -- Demote previous owner to 'administrator'
  UPDATE public.user_organizations
  SET role = 'administrator'
  WHERE org_id = p_org_id AND user_id = v_caller_id;

  -- Update users table roles
  UPDATE public.users SET role = 'owner' WHERE id = p_new_owner_id;
  UPDATE public.users SET role = 'administrator' WHERE id = v_caller_id;

  -- 4. Record sensitive audit event
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'ownership_transferred', 'organizations', p_org_id,
    jsonb_build_object('former_owner_id', v_caller_id),
    jsonb_build_object('new_owner_id', p_new_owner_id, 'new_owner_email', v_new_owner_email)
  );

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Ownership of %s transferred to %s successfully.', v_org_name, COALESCE(v_new_owner_email, 'new owner')),
    'new_owner_id', p_new_owner_id,
    'former_owner_id', v_caller_id
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_organization_ownership(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. SECURE MEMBER REMOVAL RPC (REAL-TIME REVOCATION & LAST-OWNER GUARD)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.remove_organization_member(
  p_org_id uuid,
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_is_owner boolean;
  v_target_role text;
  v_target_email text;
  v_target_name text;
  v_owner_count int;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- 1. Check primary owner protection
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Security error: The primary organization owner cannot be removed. Transfer ownership first.' USING ERRCODE = '42501';
  END IF;

  -- 2. Check last-owner retention
  SELECT role INTO v_target_role 
  FROM public.user_organizations 
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found in organization.' USING ERRCODE = 'P0002';
  END IF;

  IF v_target_role = 'owner' THEN
    SELECT count(*) INTO v_owner_count 
    FROM public.user_organizations 
    WHERE org_id = p_org_id AND role = 'owner';
    
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Security violation: Cannot remove the last organization owner.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 3. Authorize caller
  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = p_org_id;
  SELECT role INTO v_caller_role FROM public.user_organizations WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator', 'managing_director', 'ceo')
    OR public.has_org_permission(v_caller_id, p_org_id, 'members.remove')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to remove members from this organization.' USING ERRCODE = '42501';
  END IF;

  SELECT email, full_name INTO v_target_email, v_target_name FROM public.users WHERE id = p_target_user_id;

  -- 4. Real-time cleanup across operational tables
  -- Delete membership
  DELETE FROM public.user_organizations 
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- Cleanup project memberships in this org
  DELETE FROM public.project_members 
  WHERE user_id = p_target_user_id 
    AND project_id IN (SELECT id FROM public.projects WHERE org_id = p_org_id);

  -- Cleanup channel memberships in this org
  DELETE FROM public.channel_members
  WHERE user_id = p_target_user_id
    AND channel_id IN (SELECT id FROM public.chat_channels WHERE org_id = p_org_id);

  -- 5. Record audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value
  ) VALUES (
    p_org_id, v_caller_id, 'member_removed', 'user_organizations', p_target_user_id,
    jsonb_build_object('removed_email', v_target_email, 'removed_name', v_target_name, 'removed_role', v_target_role)
  );

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Member %s removed from organization.', COALESCE(v_target_name, v_target_email, 'user'))
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. LAST-OWNER RETENTION TRIGGER ON user_organizations
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_check_last_owner_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_remaining_owners int;
BEGIN
  -- If an owner is being deleted or demoted
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner') 
     OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner') THEN
    
    SELECT count(*) INTO v_remaining_owners
    FROM public.user_organizations
    WHERE org_id = OLD.org_id AND role = 'owner' AND user_id != OLD.user_id;

    IF v_remaining_owners = 0 THEN
      RAISE EXCEPTION 'Security error: Organization must retain at least one valid owner. Action blocked.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner_removal ON public.user_organizations;
CREATE TRIGGER trg_prevent_last_owner_removal
BEFORE DELETE OR UPDATE ON public.user_organizations
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_last_owner_retention();

-- ------------------------------------------------------------------------------
-- 4. INVOICE APPROVAL RPC (WITH EXPLICIT invoices.approve PERMISSION)
-- ------------------------------------------------------------------------------

-- Ensure 'approved' status is permitted in invoices_status_check
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
CHECK (((status)::text = ANY (ARRAY['draft', 'approved', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'])));

CREATE OR REPLACE FUNCTION public.approve_invoice(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_org_id uuid;
  v_current_status text;
  v_inv_number text;
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, status, invoice_number 
  INTO v_org_id, v_current_status, v_inv_number
  FROM public.invoices 
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Enforce explicit invoices.approve permission
  IF NOT (
    (EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id AND owner_id = v_caller_id))
    OR public.has_org_permission(v_caller_id, v_org_id, 'invoices.approve')
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not possess the "invoices.approve" permission.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.invoices
  SET status = 'approved', updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, old_value, new_value
  ) VALUES (
    v_org_id, v_caller_id, 'invoice_approved', 'invoices', p_invoice_id,
    jsonb_build_object('old_status', v_current_status),
    jsonb_build_object('new_status', 'approved', 'invoice_number', v_inv_number)
  );

  SELECT jsonb_build_object(
    'success', true,
    'message', format('Invoice %s successfully approved.', v_inv_number),
    'invoice_id', p_invoice_id,
    'status', 'approved'
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_invoice(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. SCOPE-ENFORCED PROJECT ACCESS FUNCTIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_view_project(p_user_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_dept_id uuid;
  v_owner_id uuid;
  v_created_by uuid;
  v_user_role text;
  v_user_dept_id uuid;
  v_custom_role_id uuid;
  v_scope_projects text := 'organization';
BEGIN
  IF p_user_id IS NULL OR p_project_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT org_id, department_id, owner_id, created_by
  INTO v_org_id, v_dept_id, v_owner_id, v_created_by
  FROM public.projects
  WHERE id = p_project_id AND (deleted_at IS NULL);

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 1. Designated project owner or creator
  IF v_owner_id = p_user_id OR v_created_by = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- 2. Explicitly assigned project member
  IF EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = p_project_id 
      AND pm.user_id = p_user_id 
      AND COALESCE(pm.is_active, true) = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Client direct contact with active authorized access
  IF EXISTS (
    SELECT 1 FROM public.project_client_access pca
    WHERE pca.project_id = p_project_id
      AND pca.user_id = p_user_id
      AND pca.status = 'active'
      AND pca.can_view = true
  ) THEN
    RETURN TRUE;
  END IF;

  -- Independent project with no org
  IF v_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 4. Organization primary owner has full visibility
  IF EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = v_org_id AND o.owner_id = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- 5. Check user's organization membership and role
  SELECT role, department_id, custom_role_id
  INTO v_user_role, v_user_dept_id, v_custom_role_id
  FROM public.user_organizations
  WHERE org_id = v_org_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Client or Guest in user_organizations: ONLY project members or client access (no default org access)
  IF v_user_role IN ('client', 'guest') THEN
    RETURN FALSE;
  END IF;

  -- 6. Check custom role scope limits if assigned
  IF v_custom_role_id IS NOT NULL THEN
    SELECT COALESCE(scope_limits->>'projects', 'organization') INTO v_scope_projects
    FROM public.organization_roles
    WHERE id = v_custom_role_id AND org_id = v_org_id AND is_active = true;

    IF v_scope_projects = 'project' OR v_scope_projects = 'assigned' THEN
      RETURN FALSE; -- Handled above via project_members
    END IF;

    IF v_scope_projects = 'department' THEN
      IF v_dept_id IS NOT NULL AND v_user_dept_id IS NOT NULL AND v_dept_id = v_user_dept_id THEN
        RETURN public.has_org_permission(p_user_id, v_org_id, 'projects.view');
      END IF;
      RETURN FALSE;
    END IF;
  END IF;

  -- 7. Built-in Department Head scope restriction: Department Heads only view projects in their department
  IF v_user_role = 'department_head' THEN
    IF v_dept_id IS NOT NULL AND v_user_dept_id IS NOT NULL AND v_dept_id = v_user_dept_id THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- 8. General permission check for projects.view
  RETURN public.has_org_permission(p_user_id, v_org_id, 'projects.view');
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_project(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. IMMUTABLE & SECURE AUDIT LOGGING POLICIES (activity_logs)
-- ------------------------------------------------------------------------------

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_deny_update" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_deny_delete" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_org_policy" ON public.activity_logs;

-- Confidential Audit Trail: Only users with audit_logs.view or owner can view
CREATE POLICY "activity_logs_select" ON public.activity_logs
FOR SELECT TO authenticated
USING (
  (org_id IS NOT NULL) AND (
    (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = activity_logs.org_id AND o.owner_id = auth.uid()))
    OR (
      EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = activity_logs.org_id AND uo.user_id = auth.uid())
      AND public.has_org_permission(auth.uid(), activity_logs.org_id, 'audit_logs.view')
    )
  )
);

-- Authorized system/user actions can create audit log entries
CREATE POLICY "activity_logs_insert" ON public.activity_logs
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    actor_id = auth.uid() OR actor_id IS NULL
  )
);

-- Strict Immutability: Audit logs cannot be modified or deleted by ANY user
CREATE POLICY "activity_logs_deny_update" ON public.activity_logs
FOR UPDATE TO authenticated
USING (false);

CREATE POLICY "activity_logs_deny_delete" ON public.activity_logs
FOR DELETE TO authenticated
USING (false);

-- ------------------------------------------------------------------------------
-- 7. REINFORCE CLIENT ISOLATION ON INVOICES AND CLIENT RECORDS
-- ------------------------------------------------------------------------------

-- Clients can only see active approved invoices for their own account
DROP POLICY IF EXISTS "Select invoices" ON public.invoices;
CREATE POLICY "Select invoices" ON public.invoices
FOR SELECT TO authenticated
USING (
  (is_deleted = false) AND (
    -- 1. Direct creator / owner
    (owner_id = auth.uid())
    OR ((creator_id IS NOT NULL) AND (creator_id = auth.uid()))
    -- 2. Organization members with invoices.view or owner
    OR (
      (organization_id IS NOT NULL) AND (
        (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = invoices.organization_id AND o.owner_id = auth.uid()))
        OR (
          (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = invoices.organization_id AND uo.user_id = auth.uid()))
          AND public.has_org_permission(auth.uid(), invoices.organization_id, 'invoices.view')
        )
      )
    )
    -- 3. Client Portal Isolation: only approved, non-draft invoices matching their specific client ID
    OR (
      (client_id IS NOT NULL)
      AND ((status)::text NOT IN ('draft', 'cancelled'))
      AND (
        (EXISTS (
          SELECT 1 FROM public.clients c 
          WHERE c.id = invoices.client_id 
            AND (c.user_id = auth.uid() OR LOWER(c.email) = LOWER(auth.jwt()->>'email'))
        ))
        OR (EXISTS (
          SELECT 1 FROM public.project_client_access pca 
          WHERE pca.client_id = invoices.client_id 
            AND pca.user_id = auth.uid() 
            AND pca.status = 'active' 
            AND pca.can_view_financials = true
        ))
      )
    )
  )
);

-- Delete invoices: strictly require invoices.delete
DROP POLICY IF EXISTS "Delete invoices" ON public.invoices;
CREATE POLICY "Delete invoices" ON public.invoices
FOR DELETE TO authenticated
USING (
  (owner_id = auth.uid())
  OR (
    (organization_id IS NOT NULL) AND (
      (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = invoices.organization_id AND o.owner_id = auth.uid()))
      OR (
        (EXISTS (SELECT 1 FROM public.user_organizations uo WHERE uo.org_id = invoices.organization_id AND uo.user_id = auth.uid()))
        AND public.has_org_permission(auth.uid(), invoices.organization_id, 'invoices.delete')
      )
    )
  )
);

-- ------------------------------------------------------------------------------
-- 8. ANTI-PRIVILEGE ESCALATION ON CUSTOM ROLES (EXPANDED)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_custom_role(
  p_org_id uuid,
  p_name text,
  p_description text,
  p_permissions jsonb,
  p_scope_limits jsonb DEFAULT '{"projects": "organization", "tasks": "organization"}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_is_owner boolean;
  v_role_key text;
  v_new_role_id uuid;
  v_requested_perm text;
  v_caller_custom_role_id uuid;
  v_caller_scope_projects text := 'organization';
  v_res jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- 1. Authorize caller
  SELECT (owner_id = v_caller_id) INTO v_is_owner FROM public.organizations WHERE id = p_org_id;
  SELECT role, custom_role_id INTO v_caller_role, v_caller_custom_role_id 
  FROM public.user_organizations 
  WHERE org_id = p_org_id AND user_id = v_caller_id;

  IF NOT (
    COALESCE(v_is_owner, false) = true
    OR v_caller_role IN ('owner', 'administrator', 'managing_director', 'ceo')
    OR public.has_org_permission(v_caller_id, p_org_id, 'roles.create')
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not possess permission to create roles.' USING ERRCODE = '42501';
  END IF;

  -- 2. Anti-privilege escalation checks
  IF COALESCE(v_is_owner, false) = false AND v_caller_role != 'owner' THEN
    -- Check permissions: cannot delegate any permission not possessed by caller
    FOR v_requested_perm IN SELECT jsonb_array_elements_text(p_permissions) LOOP
      -- Ultimate powers that cannot be placed into custom roles by non-owners
      IF v_requested_perm IN ('organization.delete', 'billing.manage') THEN
        IF NOT public.has_org_permission(v_caller_id, p_org_id, v_requested_perm) THEN
          RAISE EXCEPTION 'Privilege escalation blocked: Protected administrative permission "%" cannot be delegated.', v_requested_perm USING ERRCODE = '42501';
        END IF;
      END IF;

      IF NOT public.has_org_permission(v_caller_id, p_org_id, v_requested_perm) THEN
        RAISE EXCEPTION 'Privilege escalation blocked: You cannot grant permission "%" which you do not possess.', v_requested_perm USING ERRCODE = '42501';
      END IF;
    END LOOP;

    -- Check scope escalation: if caller has department scope, cannot create organization-wide role
    IF v_caller_custom_role_id IS NOT NULL THEN
      SELECT COALESCE(scope_limits->>'projects', 'organization') INTO v_caller_scope_projects
      FROM public.organization_roles WHERE id = v_caller_custom_role_id;
      
      IF v_caller_scope_projects = 'department' AND (p_scope_limits->>'projects') = 'organization' THEN
        RAISE EXCEPTION 'Scope escalation blocked: Department-scoped users cannot create organization-scoped roles.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- 3. Validate role name and generate key
  v_role_key := LOWER(REGEXP_REPLACE(TRIM(p_name), '[^a-zA-Z0-9]+', '_', 'g'));
  IF v_role_key IN ('owner', 'administrator', 'superadmin', 'platform_admin', 'client', 'guest') THEN
    v_role_key := 'custom_' || v_role_key || '_' || SUBSTR(gen_random_uuid()::text, 1, 6);
  END IF;

  -- 4. Insert role
  INSERT INTO public.organization_roles (
    org_id, role_key, name, description, is_system, is_active, permissions, scope_limits, created_by
  ) VALUES (
    p_org_id, v_role_key, TRIM(p_name), p_description, false, true, p_permissions, p_scope_limits, v_caller_id
  )
  RETURNING id INTO v_new_role_id;

  -- 5. Record audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'custom_role_created', 'organization_roles', v_new_role_id,
    jsonb_build_object('name', p_name, 'role_key', v_role_key, 'permissions_count', jsonb_array_length(p_permissions))
  );

  SELECT jsonb_build_object(
    'success', true,
    'role_id', v_new_role_id,
    'role_key', v_role_key,
    'name', p_name,
    'message', format('Custom role "%s" created successfully.', p_name)
  ) INTO v_res;

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_role(uuid, text, text, jsonb, jsonb) TO authenticated;

-- ------------------------------------------------------------------------------
-- 9. NOTIFY COMPLETION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'AUVRYN enterprise role limitations and security rules applied successfully.';
END $$;
