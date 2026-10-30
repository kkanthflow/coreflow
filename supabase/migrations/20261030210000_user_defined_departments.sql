-- ==============================================================================
-- AUVRYN — User-Defined Department Architecture & Dynamic Workspaces
-- Migration: 20261030210000_user_defined_departments.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND DEPARTMENTS TABLE WITH USER-DEFINED CONFIGURATION FIELDS
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
  -- Department Purpose
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'purpose'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN purpose text;
  END IF;

  -- Department Responsibilities (jsonb array of strings)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'responsibilities'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN responsibilities jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Enabled Operational Modules (jsonb array of module objects or keys)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'enabled_modules'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN enabled_modules jsonb DEFAULT '["tasks", "projects", "chat", "meetings", "announcements"]'::jsonb;
  END IF;

  -- Module Configurations (jsonb map of key -> config settings)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'module_configurations'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN module_configurations jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Department Permissions (jsonb settings)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN permissions jsonb DEFAULT '{}'::jsonb;
  END IF;

  -- Created By (uuid)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  -- Approval Status ('draft', 'configured', 'approved', 'active', 'archived')
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN approval_status text DEFAULT 'approved' CHECK (approval_status IN ('draft', 'configured', 'approved', 'active', 'archived'));
  END IF;

  -- Dynamic Questions and Answers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'dynamic_questions'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN dynamic_questions jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CREATE DEPARTMENT OPERATIONAL RECORDS TABLE (FOR STANDARD & CUSTOM MODULES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.department_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  due_date date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_records_org_dept ON public.department_records(org_id, department_id);
CREATE INDEX IF NOT EXISTS idx_dept_records_module ON public.department_records(department_id, module_key);
CREATE INDEX IF NOT EXISTS idx_dept_records_status ON public.department_records(department_id, status);

-- Enable RLS
ALTER TABLE public.department_records ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. RLS POLICIES FOR DEPARTMENT RECORDS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "dept_records_select_policy" ON public.department_records;
CREATE POLICY "dept_records_select_policy"
  ON public.department_records FOR SELECT
  TO authenticated
  USING (
    public.can_access_department(auth.uid(), department_id)
  );

DROP POLICY IF EXISTS "dept_records_insert_policy" ON public.department_records;
CREATE POLICY "dept_records_insert_policy"
  ON public.department_records FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_department(auth.uid(), department_id)
  );

DROP POLICY IF EXISTS "dept_records_update_policy" ON public.department_records;
CREATE POLICY "dept_records_update_policy"
  ON public.department_records FOR UPDATE
  TO authenticated
  USING (
    public.can_access_department(auth.uid(), department_id)
  )
  WITH CHECK (
    public.can_access_department(auth.uid(), department_id)
  );

DROP POLICY IF EXISTS "dept_records_delete_policy" ON public.department_records;
CREATE POLICY "dept_records_delete_policy"
  ON public.department_records FOR DELETE
  TO authenticated
  USING (
    public.is_org_owner(auth.uid(), org_id)
    OR EXISTS (
      SELECT 1 FROM public.departments
      WHERE id = department_records.department_id AND head_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leadership_members
      WHERE org_id = department_records.org_id AND user_id = auth.uid() AND can_manage_departments = true
    )
  );

-- ------------------------------------------------------------------------------
-- 4. ATOMIC RPC: CREATE USER-DEFINED DEPARTMENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_user_defined_department(
  p_org_id uuid,
  p_name text,
  p_description text,
  p_purpose text DEFAULT NULL,
  p_responsibilities jsonb DEFAULT '[]'::jsonb,
  p_enabled_modules jsonb DEFAULT '[]'::jsonb,
  p_module_configurations jsonb DEFAULT '{}'::jsonb,
  p_color text DEFAULT '#FF6B4A',
  p_head_user_id uuid DEFAULT NULL,
  p_initial_member_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_dynamic_questions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role varchar;
  v_is_owner boolean;
  v_can_manage boolean;
  v_dept_id uuid;
  v_channel_id uuid;
  v_mem_id uuid;
  v_clean_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    BEGIN
      v_caller_id := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_id := NULL;
    END;
  END IF;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_is_owner := public.is_org_owner(v_caller_id, p_org_id);

  SELECT role INTO v_caller_role
  FROM public.user_organizations
  WHERE org_id = p_org_id AND user_id = v_caller_id;

  SELECT can_manage_departments INTO v_can_manage
  FROM public.leadership_members
  WHERE org_id = p_org_id AND user_id = v_caller_id AND is_active = true;

  IF NOT (
    v_is_owner = true 
    OR v_caller_role IN ('owner', 'administrator') 
    OR COALESCE(v_can_manage, false) = true
    OR public.has_org_permission(v_caller_id, p_org_id, 'departments.manage')
  ) THEN
    RAISE EXCEPTION 'Access denied. Only organization owners and authorized administrators can create departments.' USING ERRCODE = '42501';
  END IF;

  v_clean_name := TRIM(p_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Department name must be at least 2 characters.' USING ERRCODE = '22023';
  END IF;

  -- Insert department record
  INSERT INTO public.departments (
    org_id,
    name,
    description,
    purpose,
    responsibilities,
    enabled_modules,
    module_configurations,
    color,
    head_user_id,
    created_by,
    approval_status,
    dynamic_questions,
    status
  ) VALUES (
    p_org_id,
    v_clean_name,
    NULLIF(TRIM(p_description), ''),
    NULLIF(TRIM(p_purpose), ''),
    COALESCE(p_responsibilities, '[]'::jsonb),
    COALESCE(p_enabled_modules, '["tasks", "projects", "chat", "meetings", "announcements"]'::jsonb),
    COALESCE(p_module_configurations, '{}'::jsonb),
    COALESCE(p_color, '#FF6B4A'),
    p_head_user_id,
    v_caller_id,
    'approved',
    COALESCE(p_dynamic_questions, '[]'::jsonb),
    'active'
  )
  RETURNING id INTO v_dept_id;

  -- Create dedicated department chat channel
  INSERT INTO public.chat_channels (
    org_id,
    name,
    type,
    description,
    is_private,
    created_by,
    department_id
  ) VALUES (
    p_org_id,
    LOWER(REGEXP_REPLACE(v_clean_name, '\s+', '-', 'g')),
    'department',
    'Dedicated communication channel for ' || v_clean_name,
    false,
    v_caller_id,
    v_dept_id
  )
  RETURNING id INTO v_channel_id;

  -- If head user specified, assign as department head in department_members
  IF p_head_user_id IS NOT NULL THEN
    INSERT INTO public.department_members (
      org_id, department_id, user_id, department_role, is_primary, assigned_by
    ) VALUES (
      p_org_id, v_dept_id, p_head_user_id, 'head', true, v_caller_id
    ) ON CONFLICT (department_id, user_id) 
    DO UPDATE SET department_role = 'head';
  END IF;

  -- Add initial members
  IF p_initial_member_ids IS NOT NULL AND array_length(p_initial_member_ids, 1) > 0 THEN
    FOREACH v_mem_id IN ARRAY p_initial_member_ids
    LOOP
      IF v_mem_id IS NOT NULL AND (p_head_user_id IS NULL OR v_mem_id <> p_head_user_id) THEN
        INSERT INTO public.department_members (
          org_id, department_id, user_id, department_role, is_primary, assigned_by
        ) VALUES (
          p_org_id, v_dept_id, v_mem_id, 'member', true, v_caller_id
        ) ON CONFLICT (department_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Log activity
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    p_org_id,
    v_caller_id,
    'create_user_defined_department',
    'department',
    v_dept_id,
    jsonb_build_object(
      'name', v_clean_name,
      'purpose', p_purpose,
      'enabled_modules', p_enabled_modules,
      'head_user_id', p_head_user_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'department_id', v_dept_id,
    'channel_id', v_channel_id,
    'name', v_clean_name
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. ATOMIC RPC: UPDATE DEPARTMENT CONFIGURATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_department_configuration(
  p_org_id uuid,
  p_department_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_purpose text DEFAULT NULL,
  p_responsibilities jsonb DEFAULT NULL,
  p_enabled_modules jsonb DEFAULT NULL,
  p_module_configurations jsonb DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_head_user_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_owner boolean;
  v_caller_role varchar;
  v_can_manage boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    BEGIN
      v_caller_id := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_caller_id := NULL;
    END;
  END IF;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_is_owner := public.is_org_owner(v_caller_id, p_org_id);

  SELECT role INTO v_caller_role
  FROM public.user_organizations
  WHERE org_id = p_org_id AND user_id = v_caller_id;

  SELECT can_manage_departments INTO v_can_manage
  FROM public.leadership_members
  WHERE org_id = p_org_id AND user_id = v_caller_id AND is_active = true;

  IF NOT (
    v_is_owner = true 
    OR v_caller_role IN ('owner', 'administrator') 
    OR COALESCE(v_can_manage, false) = true
    OR public.has_org_permission(v_caller_id, p_org_id, 'departments.manage')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to configure this department.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.departments
  SET
    name = COALESCE(NULLIF(TRIM(p_name), ''), name),
    description = COALESCE(p_description, description),
    purpose = COALESCE(p_purpose, purpose),
    responsibilities = COALESCE(p_responsibilities, responsibilities),
    enabled_modules = COALESCE(p_enabled_modules, enabled_modules),
    module_configurations = COALESCE(p_module_configurations, module_configurations),
    color = COALESCE(p_color, color),
    head_user_id = COALESCE(p_head_user_id, head_user_id),
    status = COALESCE(p_status, status)
  WHERE id = p_department_id AND org_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'department_id', p_department_id
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_user_defined_department(uuid, text, text, text, jsonb, jsonb, jsonb, text, uuid, uuid[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_department_configuration(uuid, uuid, text, text, text, jsonb, jsonb, jsonb, text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
