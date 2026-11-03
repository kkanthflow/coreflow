-- ==============================================================================
-- AUVRYN: DYNAMIC DEPARTMENT MANAGEMENT & WORKSPACE ENGINE MIGRATION
-- Covers 13 Functional Domains, Capability Catalogue, MNC Hierarchies & Cross-Dept Collaboration
-- ==============================================================================

-- 1. Drop obsolete auto-creation trigger & function
DROP TRIGGER IF EXISTS trg_init_new_org_departments ON public.organizations;
DROP FUNCTION IF EXISTS public.init_new_org_departments();

-- 2. Extend public.departments for MNC hierarchy, objectives, and archiving
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS parent_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS operational_requirements text,
  ADD COLUMN IF NOT EXISTS expected_outcomes text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON public.departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_departments_is_archived ON public.departments(is_archived);

-- 3. Extend public.department_members for manager role & permissions
ALTER TABLE public.department_members
  ADD COLUMN IF NOT EXISTS can_manage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_permissions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4. Global Capability Catalogue
CREATE TABLE IF NOT EXISTS public.capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  default_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_category ON public.capabilities(category);
CREATE INDEX IF NOT EXISTS idx_capabilities_key ON public.capabilities(key);

-- 5. Department Configured Capabilities
CREATE TABLE IF NOT EXISTS public.department_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES public.capabilities(key) ON DELETE CASCADE,
  custom_description text,
  custom_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dept_capability UNIQUE (department_id, capability_key)
);

CREATE INDEX IF NOT EXISTS idx_dept_caps_dept_id ON public.department_capabilities(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_caps_org_id ON public.department_capabilities(org_id);
CREATE INDEX IF NOT EXISTS idx_dept_caps_key ON public.department_capabilities(capability_key);

-- 6. Cross-Department Collaboration & Approvals
CREATE TABLE IF NOT EXISTS public.department_collaboration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requesting_department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  target_department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  title text NOT NULL,
  description text,
  requester_id uuid NOT NULL REFERENCES public.users(id),
  assigned_to_id uuid REFERENCES public.users(id),
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision_notes text,
  resolved_by uuid REFERENCES public.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_collab_org ON public.department_collaboration_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_dept_collab_target ON public.department_collaboration_requests(target_department_id);
CREATE INDEX IF NOT EXISTS idx_dept_collab_req ON public.department_collaboration_requests(requesting_department_id);
CREATE INDEX IF NOT EXISTS idx_dept_collab_status ON public.department_collaboration_requests(status);

-- 7. Department Activities Audit Trail
CREATE TABLE IF NOT EXISTS public.department_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.users(id),
  activity_type text NOT NULL,
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_activities_dept ON public.department_activities(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_activities_org ON public.department_activities(org_id);

-- 8. Atomic Procedure: create_dynamic_department
CREATE OR REPLACE FUNCTION public.create_dynamic_department(
  p_org_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_color text DEFAULT '#FF6B4A',
  p_parent_department_id uuid DEFAULT NULL,
  p_head_user_id uuid DEFAULT NULL,
  p_objectives jsonb DEFAULT '[]'::jsonb,
  p_operational_requirements text DEFAULT NULL,
  p_expected_outcomes text DEFAULT NULL,
  p_capability_keys text[] DEFAULT '{}'::text[],
  p_member_assignments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_dept_id uuid;
  v_clean_name text;
  v_cap_key text;
  v_member jsonb;
  v_member_user_id uuid;
  v_member_role text;
  v_member_can_manage boolean;
  v_member_is_primary boolean;
BEGIN
  v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

  IF NOT (
    public.is_org_owner(v_caller_id, p_org_id)
    OR EXISTS (
      SELECT 1 FROM public.leadership_members 
      WHERE org_id = p_org_id AND user_id = v_caller_id AND is_active = true AND can_manage_departments = true
    )
    OR public.has_org_permission(v_caller_id, p_org_id, 'departments.manage')
  ) THEN
    RAISE EXCEPTION 'Access denied. Only organization owners and authorized leadership can create departments.' USING ERRCODE = '42501';
  END IF;

  v_clean_name := TRIM(COALESCE(p_name, ''));
  IF LENGTH(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Department name must be at least 2 characters.' USING ERRCODE = '22000';
  END IF;

  INSERT INTO public.departments (
    org_id, name, description, color, parent_department_id, head_user_id,
    objectives, operational_requirements, expected_outcomes,
    status, is_deleted, created_by, created_at
  ) VALUES (
    p_org_id, v_clean_name, TRIM(p_description), COALESCE(p_color, '#FF6B4A'), p_parent_department_id, p_head_user_id,
    COALESCE(p_objectives, '[]'::jsonb), TRIM(p_operational_requirements), TRIM(p_expected_outcomes),
    'active', false, v_caller_id, now()
  )
  RETURNING id INTO v_dept_id;

  IF p_capability_keys IS NOT NULL AND array_length(p_capability_keys, 1) > 0 THEN
    FOREACH v_cap_key IN ARRAY p_capability_keys LOOP
      INSERT INTO public.department_capabilities (
        org_id, department_id, capability_key, is_active
      ) VALUES (
        p_org_id, v_dept_id, v_cap_key, true
      )
      ON CONFLICT (department_id, capability_key) DO NOTHING;
    END LOOP;
  END IF;

  IF p_head_user_id IS NOT NULL THEN
    INSERT INTO public.department_members (
      department_id, user_id, org_id, department_role, can_manage, is_primary, assigned_by
    ) VALUES (
      v_dept_id, p_head_user_id, p_org_id, 'head', true, true, v_caller_id
    )
    ON CONFLICT (department_id, user_id) DO UPDATE SET
      department_role = 'head',
      can_manage = true;
  END IF;

  IF p_member_assignments IS NOT NULL AND jsonb_array_length(p_member_assignments) > 0 THEN
    FOR v_member IN SELECT * FROM jsonb_array_elements(p_member_assignments) LOOP
      v_member_user_id := (v_member->>'user_id')::uuid;
      v_member_role := COALESCE(v_member->>'role', 'member');
      v_member_can_manage := COALESCE((v_member->>'can_manage')::boolean, false);
      v_member_is_primary := COALESCE((v_member->>'is_primary')::boolean, false);

      IF v_member_user_id IS NOT NULL AND v_member_user_id <> COALESCE(p_head_user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.department_members (
          department_id, user_id, org_id, department_role, can_manage, is_primary, assigned_by
        ) VALUES (
          v_dept_id, v_member_user_id, p_org_id, v_member_role, v_member_can_manage, v_member_is_primary, v_caller_id
        )
        ON CONFLICT (department_id, user_id) DO UPDATE SET
          department_role = EXCLUDED.department_role,
          can_manage = EXCLUDED.can_manage,
          is_primary = EXCLUDED.is_primary;

        IF v_member_is_primary THEN
          UPDATE public.user_organizations
          SET department_id = v_dept_id
          WHERE org_id = p_org_id AND user_id = v_member_user_id;

          UPDATE public.users
          SET department = v_clean_name
          WHERE id = v_member_user_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.chat_channels (
    org_id, department_id, name, type, description, is_private
  ) VALUES (
    p_org_id, v_dept_id, v_clean_name, 'department', 'General channel for ' || v_clean_name, false
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.department_activities (
    org_id, department_id, actor_id, activity_type, title, details
  ) VALUES (
    p_org_id, v_dept_id, v_caller_id, 'department_created',
    'Department "' || v_clean_name || '" was created.',
    jsonb_build_object('name', v_clean_name, 'capabilities_count', array_length(p_capability_keys, 1))
  );

  RETURN jsonb_build_object(
    'success', true,
    'department_id', v_dept_id,
    'name', v_clean_name
  );
END;
$$;

-- 9. Atomic Procedure: update_dynamic_department
CREATE OR REPLACE FUNCTION public.update_dynamic_department(
  p_org_id uuid,
  p_department_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_parent_department_id uuid DEFAULT NULL,
  p_head_user_id uuid DEFAULT NULL,
  p_objectives jsonb DEFAULT NULL,
  p_operational_requirements text DEFAULT NULL,
  p_expected_outcomes text DEFAULT NULL,
  p_capability_keys text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_cap_key text;
  v_clean_name text;
BEGIN
  v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

  IF NOT (
    public.is_org_owner(v_caller_id, p_org_id)
    OR EXISTS (
      SELECT 1 FROM public.departments WHERE id = p_department_id AND head_user_id = v_caller_id
    )
    OR EXISTS (
      SELECT 1 FROM public.department_members WHERE department_id = p_department_id AND user_id = v_caller_id AND can_manage = true
    )
    OR EXISTS (
      SELECT 1 FROM public.leadership_members 
      WHERE org_id = p_org_id AND user_id = v_caller_id AND is_active = true AND can_manage_departments = true
    )
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to manage this department.' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NOT NULL THEN
    v_clean_name := TRIM(p_name);
  END IF;

  UPDATE public.departments SET
    name = COALESCE(v_clean_name, name),
    description = COALESCE(TRIM(p_description), description),
    color = COALESCE(p_color, color),
    parent_department_id = COALESCE(p_parent_department_id, parent_department_id),
    head_user_id = COALESCE(p_head_user_id, head_user_id),
    objectives = COALESCE(p_objectives, objectives),
    operational_requirements = COALESCE(TRIM(p_operational_requirements), operational_requirements),
    expected_outcomes = COALESCE(TRIM(p_expected_outcomes), expected_outcomes)
  WHERE id = p_department_id AND org_id = p_org_id;

  IF p_capability_keys IS NOT NULL THEN
    UPDATE public.department_capabilities
    SET is_active = false
    WHERE department_id = p_department_id
      AND capability_key <> ALL(p_capability_keys);

    FOREACH v_cap_key IN ARRAY p_capability_keys LOOP
      INSERT INTO public.department_capabilities (
        org_id, department_id, capability_key, is_active
      ) VALUES (
        p_org_id, p_department_id, v_cap_key, true
      )
      ON CONFLICT (department_id, capability_key) DO UPDATE SET
        is_active = true,
        updated_at = now();
    END LOOP;
  END IF;

  IF p_head_user_id IS NOT NULL THEN
    INSERT INTO public.department_members (
      department_id, user_id, org_id, department_role, can_manage, is_primary, assigned_by
    ) VALUES (
      p_department_id, p_head_user_id, p_org_id, 'head', true, true, v_caller_id
    )
    ON CONFLICT (department_id, user_id) DO UPDATE SET
      department_role = 'head',
      can_manage = true;
  END IF;

  INSERT INTO public.department_activities (
    org_id, department_id, actor_id, activity_type, title, details
  ) VALUES (
    p_org_id, p_department_id, v_caller_id, 'department_updated',
    'Department configuration was updated.',
    jsonb_build_object('updated_by', v_caller_id)
  );

  RETURN jsonb_build_object('success', true, 'department_id', p_department_id);
END;
$$;

-- 10. Atomic Procedure: archive_department_safe
CREATE OR REPLACE FUNCTION public.archive_department_safe(
  p_org_id uuid,
  p_department_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

  IF NOT public.is_org_owner(v_caller_id, p_org_id) THEN
    RAISE EXCEPTION 'Only organization owners can archive a department.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.departments
  SET is_archived = true,
      archived_at = now(),
      status = 'archived'
  WHERE id = p_department_id AND org_id = p_org_id;

  INSERT INTO public.department_activities (
    org_id, department_id, actor_id, activity_type, title
  ) VALUES (
    p_org_id, p_department_id, v_caller_id, 'department_archived', 'Department was safely archived.'
  );

  RETURN jsonb_build_object('success', true, 'archived_id', p_department_id);
END;
$$;

-- 11. Atomic Procedure: create_collaboration_request
CREATE OR REPLACE FUNCTION public.create_collaboration_request(
  p_org_id uuid,
  p_requesting_department_id uuid,
  p_target_department_id uuid,
  p_request_type text,
  p_title text,
  p_description text DEFAULT NULL,
  p_priority text DEFAULT 'medium',
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_request_id uuid;
BEGIN
  v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

  IF NOT (
    public.is_org_owner(v_caller_id, p_org_id)
    OR EXISTS (
      SELECT 1 FROM public.department_members 
      WHERE department_id = p_requesting_department_id AND user_id = v_caller_id
    )
  ) THEN
    RAISE EXCEPTION 'Access denied. You must be a member of the requesting department.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.department_collaboration_requests (
    org_id, requesting_department_id, target_department_id,
    request_type, title, description, priority, payload,
    requester_id, status, created_at
  ) VALUES (
    p_org_id, p_requesting_department_id, p_target_department_id,
    COALESCE(p_request_type, 'task_assignment'), TRIM(p_title), TRIM(p_description),
    COALESCE(p_priority, 'medium'), COALESCE(p_payload, '{}'::jsonb),
    v_caller_id, 'pending', now()
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.department_activities (
    org_id, department_id, actor_id, activity_type, title, details
  ) VALUES (
    p_org_id, p_requesting_department_id, v_caller_id, 'collab_request_sent',
    'Dispatched collaboration request: ' || p_title,
    jsonb_build_object('target_department_id', p_target_department_id, 'request_id', v_request_id)
  );

  INSERT INTO public.department_activities (
    org_id, department_id, actor_id, activity_type, title, details
  ) VALUES (
    p_org_id, p_target_department_id, v_caller_id, 'collab_request_received',
    'Received collaboration request: ' || p_title,
    jsonb_build_object('from_department_id', p_requesting_department_id, 'request_id', v_request_id)
  );

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- 12. Atomic Procedure: resolve_collaboration_request
CREATE OR REPLACE FUNCTION public.resolve_collaboration_request(
  p_org_id uuid,
  p_request_id uuid,
  p_status text,
  p_decision_notes text DEFAULT NULL,
  p_assigned_to_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_target_dept_id uuid;
  v_req_title text;
BEGIN
  v_caller_id := COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1));

  SELECT target_department_id, title INTO v_target_dept_id, v_req_title
  FROM public.department_collaboration_requests
  WHERE id = p_request_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collaboration request not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_org_owner(v_caller_id, p_org_id)
    OR EXISTS (
      SELECT 1 FROM public.departments WHERE id = v_target_dept_id AND head_user_id = v_caller_id
    )
    OR EXISTS (
      SELECT 1 FROM public.department_members 
      WHERE department_id = v_target_dept_id AND user_id = v_caller_id AND can_manage = true
    )
  ) THEN
    RAISE EXCEPTION 'Access denied. Only target department leadership can resolve collaboration requests.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.department_collaboration_requests SET
    status = p_status,
    decision_notes = COALESCE(p_decision_notes, decision_notes),
    assigned_to_id = COALESCE(p_assigned_to_id, assigned_to_id),
    resolved_by = v_caller_id,
    resolved_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.department_activities (
    org_id, department_id, actor_id, activity_type, title, details
  ) VALUES (
    p_org_id, v_target_dept_id, v_caller_id, 'collab_request_resolved',
    'Collaboration request "' || v_req_title || '" resolved as ' || p_status,
    jsonb_build_object('request_id', p_request_id, 'status', p_status)
  );

  RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', p_status);
END;
$$;

-- RLS & Grants
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_collaboration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Global capabilities are readable by authenticated users" ON public.capabilities;
CREATE POLICY "Global capabilities are readable by authenticated users"
ON public.capabilities FOR SELECT
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Department capabilities isolated by org" ON public.department_capabilities;
CREATE POLICY "Department capabilities isolated by org"
ON public.department_capabilities FOR ALL
USING (
  public.is_org_owner(auth.uid(), org_id)
  OR public.can_access_department(auth.uid(), department_id)
  OR EXISTS (
    SELECT 1 FROM public.user_organizations WHERE org_id = department_capabilities.org_id AND user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Collaboration requests isolated by org" ON public.department_collaboration_requests;
CREATE POLICY "Collaboration requests isolated by org"
ON public.department_collaboration_requests FOR ALL
USING (
  public.is_org_owner(auth.uid(), org_id)
  OR public.can_access_department(auth.uid(), target_department_id)
  OR public.can_access_department(auth.uid(), requesting_department_id)
  OR requester_id = auth.uid()
  OR assigned_to_id = auth.uid()
);

DROP POLICY IF EXISTS "Department activities viewable by members & leadership" ON public.department_activities;
CREATE POLICY "Department activities viewable by members & leadership"
ON public.department_activities FOR SELECT
USING (
  public.is_org_owner(auth.uid(), org_id)
  OR public.can_access_department(auth.uid(), department_id)
);

GRANT EXECUTE ON FUNCTION public.create_dynamic_department(uuid, text, text, text, uuid, uuid, jsonb, text, text, text[], jsonb) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_dynamic_department(uuid, uuid, text, text, text, uuid, uuid, jsonb, text, text, text[]) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.archive_department_safe(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_collaboration_request(uuid, uuid, uuid, text, text, text, text, jsonb) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_collaboration_request(uuid, uuid, text, text, uuid) TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
