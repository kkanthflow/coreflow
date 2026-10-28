-- ==============================================================================
-- AUVRYN — Fix invoice_payments RLS and Record Payments Permission
-- ==============================================================================

-- 1. Ensure 'record_payments', 'payments.record', 'payments.view', 'payments.manage' 
--    are added to owner, administrator, and manager roles in public.roles
UPDATE public.roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM jsonb_array_elements_text(
    permissions || '["record_payments", "payments.record", "payments.view", "payments.manage", "invoices.approve"]'::jsonb
  ) AS elem
)
WHERE role_name IN ('owner', 'administrator');

UPDATE public.roles
SET permissions = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM jsonb_array_elements_text(
    permissions || '["record_payments", "payments.record", "payments.view"]'::jsonb
  ) AS elem
)
WHERE role_name = 'manager';

-- 2. Update has_org_permission function to recognize payment permission aliases
CREATE OR REPLACE FUNCTION public.has_org_permission(
  p_user_id uuid,
  p_org_id uuid,
  p_permission text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_custom_role_id uuid;
  v_has boolean := false;
  v_perm_alt text;
BEGIN
  IF p_user_id IS NULL OR p_permission IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Primary Organization Owner has unconditional permissions
  IF p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organizations WHERE id = p_org_id AND owner_id = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- Canonical alias resolver (dot vs underscore notation)
  v_perm_alt := CASE 
    WHEN p_permission = 'organization.view' THEN 'manage_organization'
    WHEN p_permission = 'organization.update' THEN 'manage_organization'
    WHEN p_permission = 'members.view' THEN 'view_team_directory'
    WHEN p_permission = 'members.invite' THEN 'invite_users'
    WHEN p_permission = 'members.remove' THEN 'remove_users'
    WHEN p_permission = 'members.assign_roles' THEN 'manage_roles'
    WHEN p_permission = 'roles.view' THEN 'manage_roles'
    WHEN p_permission = 'roles.create' THEN 'manage_roles'
    WHEN p_permission = 'roles.assign' THEN 'manage_roles'
    WHEN p_permission = 'projects.view' THEN 'view_projects'
    WHEN p_permission = 'projects.create' THEN 'create_projects'
    WHEN p_permission = 'projects.update' THEN 'manage_projects'
    WHEN p_permission = 'projects.delete' THEN 'manage_all_projects'
    WHEN p_permission = 'tasks.view' THEN 'manage_tasks'
    WHEN p_permission = 'tasks.create' THEN 'create_tasks'
    WHEN p_permission = 'tasks.update' THEN 'manage_tasks'
    WHEN p_permission = 'tasks.assign' THEN 'assign_tasks'
    WHEN p_permission = 'invoices.view' THEN 'view_invoices'
    WHEN p_permission = 'invoices.create' THEN 'create_invoices'
    WHEN p_permission = 'invoices.update' THEN 'edit_invoices'
    WHEN p_permission = 'invoices.approve' THEN 'approve_invoices'
    WHEN p_permission = 'invoices.delete' THEN 'delete_invoices'
    WHEN p_permission = 'record_payments' THEN 'payments.record'
    WHEN p_permission = 'payments.record' THEN 'record_payments'
    WHEN p_permission = 'payments.view' THEN 'view_invoices'
    WHEN p_permission = 'payments.manage' THEN 'record_payments'
    WHEN p_permission = 'clients.view' THEN 'manage_clients'
    WHEN p_permission = 'clients.create' THEN 'manage_clients'
    WHEN p_permission = 'clients.update' THEN 'manage_clients'
    WHEN p_permission = 'chat.view' THEN 'send_messages'
    WHEN p_permission = 'chat.send' THEN 'send_messages'
    WHEN p_permission = 'chat.manage' THEN 'manage_chat'
    WHEN p_permission = 'meetings.view' THEN 'schedule_meetings'
    WHEN p_permission = 'meetings.create' THEN 'schedule_meetings'
    WHEN p_permission = 'reports.view' THEN 'view_reports'
    WHEN p_permission = 'reports.export' THEN 'export_reports'
    WHEN p_permission = 'audit_logs.view' THEN 'view_audit_logs'
    ELSE NULL
  END;

  -- Check user's role and custom_role in user_organizations
  IF p_org_id IS NOT NULL THEN
    SELECT role, custom_role_id INTO v_role, v_custom_role_id 
    FROM public.user_organizations 
    WHERE org_id = p_org_id AND user_id = p_user_id;

    IF v_role = 'owner' THEN
      RETURN TRUE;
    END IF;

    -- A. Check custom organization role
    IF v_custom_role_id IS NOT NULL THEN
      SELECT (
        (permissions ? p_permission) 
        OR (v_perm_alt IS NOT NULL AND permissions ? v_perm_alt)
      ) INTO v_has
      FROM public.organization_roles
      WHERE id = v_custom_role_id AND org_id = p_org_id AND is_active = true;

      IF COALESCE(v_has, false) = true THEN
        RETURN TRUE;
      END IF;
    END IF;

    -- B. Check built-in role in public.roles
    IF v_role IS NOT NULL THEN
      SELECT (
        (permissions ? p_permission)
        OR (v_perm_alt IS NOT NULL AND permissions ? v_perm_alt)
      ) INTO v_has
      FROM public.roles
      WHERE role_name = v_role;

      IF COALESCE(v_has, false) = true THEN
        RETURN TRUE;
      END IF;

      -- Map legacy 'employee' to 'team_member' permissions
      IF v_role = 'employee' THEN
        SELECT (
          (permissions ? p_permission)
          OR (v_perm_alt IS NOT NULL AND permissions ? v_perm_alt)
        ) INTO v_has
        FROM public.roles
        WHERE role_name = 'team_member';

        IF COALESCE(v_has, false) = true THEN
          RETURN TRUE;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Check explicit individual permission grants in role_permissions table
  IF p_org_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.role_permissions 
    WHERE org_id = p_org_id AND user_id = p_user_id 
      AND (permission = p_permission OR permission = v_perm_alt)
  ) THEN
    RETURN TRUE;
  END IF;

  -- Fallback to global has_permission
  RETURN public.has_permission(p_user_id, p_permission);
END;
$$;

-- 3. Replace RLS Policies on public.invoice_payments to allow:
--    - Invoice creator / owner
--    - Organization owner
--    - Organization members with 'owner', 'administrator', or 'manager' role
--    - Users with 'record_payments' permission (via has_org_permission or has_permission)

DROP POLICY IF EXISTS "Insert payments" ON public.invoice_payments;
CREATE POLICY "Insert payments" ON public.invoice_payments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_payments.invoice_id
      AND (
        -- Personal invoice owner
        (i.organization_id IS NULL AND i.owner_id = (SELECT auth.uid()))
        -- Organization invoice
        OR (
          i.organization_id IS NOT NULL AND (
            -- Org owner
            EXISTS (
              SELECT 1 FROM public.organizations o
              WHERE o.id = i.organization_id AND o.owner_id = (SELECT auth.uid())
            )
            -- Org member with role or permission
            OR EXISTS (
              SELECT 1 FROM public.user_organizations uo
              WHERE uo.org_id = i.organization_id 
                AND uo.user_id = (SELECT auth.uid())
                AND (
                  uo.role IN ('owner', 'administrator', 'manager')
                  OR public.has_org_permission((SELECT auth.uid()), i.organization_id, 'record_payments')
                  OR public.has_permission((SELECT auth.uid()), 'record_payments')
                )
            )
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Update payments" ON public.invoice_payments;
CREATE POLICY "Update payments" ON public.invoice_payments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_payments.invoice_id
      AND (
        (i.organization_id IS NULL AND i.owner_id = (SELECT auth.uid()))
        OR (
          i.organization_id IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM public.organizations o
              WHERE o.id = i.organization_id AND o.owner_id = (SELECT auth.uid())
            )
            OR EXISTS (
              SELECT 1 FROM public.user_organizations uo
              WHERE uo.org_id = i.organization_id 
                AND uo.user_id = (SELECT auth.uid())
                AND (
                  uo.role IN ('owner', 'administrator', 'manager')
                  OR public.has_org_permission((SELECT auth.uid()), i.organization_id, 'record_payments')
                  OR public.has_permission((SELECT auth.uid()), 'record_payments')
                )
            )
          )
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_payments.invoice_id
      AND (
        (i.organization_id IS NULL AND i.owner_id = (SELECT auth.uid()))
        OR (
          i.organization_id IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM public.organizations o
              WHERE o.id = i.organization_id AND o.owner_id = (SELECT auth.uid())
            )
            OR EXISTS (
              SELECT 1 FROM public.user_organizations uo
              WHERE uo.org_id = i.organization_id 
                AND uo.user_id = (SELECT auth.uid())
                AND (
                  uo.role IN ('owner', 'administrator', 'manager')
                  OR public.has_org_permission((SELECT auth.uid()), i.organization_id, 'record_payments')
                  OR public.has_permission((SELECT auth.uid()), 'record_payments')
                )
            )
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "Delete payments" ON public.invoice_payments;
CREATE POLICY "Delete payments" ON public.invoice_payments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_payments.invoice_id
      AND (
        (i.organization_id IS NULL AND i.owner_id = (SELECT auth.uid()))
        OR (
          i.organization_id IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM public.organizations o
              WHERE o.id = i.organization_id AND o.owner_id = (SELECT auth.uid())
            )
            OR EXISTS (
              SELECT 1 FROM public.user_organizations uo
              WHERE uo.org_id = i.organization_id 
                AND uo.user_id = (SELECT auth.uid())
                AND (
                  uo.role IN ('owner', 'administrator')
                  OR public.has_org_permission((SELECT auth.uid()), i.organization_id, 'delete_invoices')
                  OR public.has_permission((SELECT auth.uid()), 'delete_invoices')
                )
            )
          )
        )
      )
  )
);
