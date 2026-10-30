-- ==============================================================================
-- AUVRYN — Multi-Founder, Multi-Owner, Leadership Team & Department Workspace System
-- Migration: 20261030200000_multi_owner_leadership_departments.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND EXISTING TABLES
-- ------------------------------------------------------------------------------

-- Add status column to departments if not present
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.departments ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;
END $$;

-- Add department_id to chat_channels and update type constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chat_channels' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.chat_channels ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_chat_channels_dept_id ON public.chat_channels(department_id);
  END IF;
END $$;

ALTER TABLE public.chat_channels DROP CONSTRAINT IF EXISTS chat_channels_type_check;
ALTER TABLE public.chat_channels ADD CONSTRAINT chat_channels_type_check 
  CHECK (type = ANY (ARRAY['org_general'::text, 'org_announcement'::text, 'project'::text, 'direct'::text, 'department'::text]));

-- Add department_id to tasks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_tasks_dept_id ON public.tasks(department_id);
  END IF;
END $$;

-- Add department_id to meetings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.meetings ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_meetings_dept_id ON public.meetings(department_id);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CREATE LOGICAL ENTITY TABLES
-- ------------------------------------------------------------------------------

-- 2.1 Multi-Owner Architecture: organization_owners
CREATE TABLE IF NOT EXISTS public.organization_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  appointed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  appointed_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resigned', 'removed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_org_owner_membership UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_owners_org_id ON public.organization_owners(org_id);
CREATE INDEX IF NOT EXISTS idx_org_owners_user_id ON public.organization_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_org_owners_status ON public.organization_owners(org_id, status);

-- 2.2 Leadership Team Management: leadership_members
CREATE TABLE IF NOT EXISTS public.leadership_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  designation text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  reporting_to_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  visibility_level text NOT NULL DEFAULT 'department' CHECK (visibility_level IN ('full_organization', 'all_departments', 'selected_departments', 'department', 'project_specific', 'read_only')),
  can_manage_departments boolean DEFAULT false,
  can_manage_leadership boolean DEFAULT false,
  can_manage_announcements boolean DEFAULT true,
  is_active boolean DEFAULT true,
  appointed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  appointed_at timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_leadership_org_user UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_leadership_org_id ON public.leadership_members(org_id);
CREATE INDEX IF NOT EXISTS idx_leadership_user_id ON public.leadership_members(user_id);

-- 2.3 Department Membership: department_members
CREATE TABLE IF NOT EXISTS public.department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_role text NOT NULL DEFAULT 'member' CHECK (department_role IN ('head', 'lead', 'member')),
  is_primary boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_dept_user UNIQUE (department_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dept_members_dept_id ON public.department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_user_id ON public.department_members(user_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_org_id ON public.department_members(org_id);

-- 2.4 Department Announcements: department_announcements
CREATE TABLE IF NOT EXISTS public.department_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dept_announcements_dept ON public.department_announcements(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_announcements_org ON public.department_announcements(org_id);

-- ------------------------------------------------------------------------------
-- 3. DATA BACKFILL
-- ------------------------------------------------------------------------------

-- 3.1 Backfill organization_owners from organizations.owner_id
INSERT INTO public.organization_owners (org_id, user_id, appointed_by, status, notes)
SELECT o.id, o.owner_id, o.owner_id, 'active', 'Initial organization owner'
FROM public.organizations o
WHERE o.owner_id IS NOT NULL
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Also backfill any users with role = 'owner' in user_organizations
INSERT INTO public.organization_owners (org_id, user_id, appointed_by, status, notes)
SELECT uo.org_id, uo.user_id, uo.user_id, 'active', 'Co-owner appointment'
FROM public.user_organizations uo
WHERE uo.role = 'owner'
ON CONFLICT (org_id, user_id) DO UPDATE SET status = 'active';

-- 3.2 Backfill department_members from user_organizations.department_id
INSERT INTO public.department_members (department_id, user_id, org_id, department_role, is_primary)
SELECT uo.department_id, uo.user_id, uo.org_id, 
  CASE WHEN d.head_user_id = uo.user_id THEN 'head' ELSE 'member' END,
  true
FROM public.user_organizations uo
JOIN public.departments d ON d.id = uo.department_id
WHERE uo.department_id IS NOT NULL
ON CONFLICT (department_id, user_id) DO NOTHING;

-- Also ensure department heads are registered in department_members
INSERT INTO public.department_members (department_id, user_id, org_id, department_role, is_primary)
SELECT d.id, d.head_user_id, d.org_id, 'head', true
FROM public.departments d
WHERE d.head_user_id IS NOT NULL AND d.is_deleted = false
ON CONFLICT (department_id, user_id) DO UPDATE SET department_role = 'head';

-- 3.3 Ensure every active department has a corresponding department chat channel
INSERT INTO public.chat_channels (org_id, department_id, name, description, type, is_private, created_by)
SELECT d.org_id, d.id, d.name || ' Chat', 'Real-time department workspace channel for ' || d.name, 'department', false, d.head_user_id
FROM public.departments d
WHERE d.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM public.chat_channels cc 
    WHERE cc.department_id = d.id
  );

-- ------------------------------------------------------------------------------
-- 4. CORE SECURITY & ACCESS FUNCTIONS
-- ------------------------------------------------------------------------------

-- Helper: Check if user is an active owner of the organization
CREATE OR REPLACE FUNCTION public.is_org_owner(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_org_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.organization_owners
    WHERE org_id = p_org_id AND user_id = p_user_id AND status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id AND owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE org_id = p_org_id AND user_id = p_user_id AND role = 'owner'
  );
END;
$$;

-- Helper: Check if user can access a specific department workspace
CREATE OR REPLACE FUNCTION public.can_access_department(p_user_id uuid, p_dept_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_dept_head uuid;
BEGIN
  IF p_user_id IS NULL OR p_dept_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT org_id, head_user_id INTO v_org_id, v_dept_head
  FROM public.departments
  WHERE id = p_dept_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1. All active Organization Owners have full access to all departments
  IF public.is_org_owner(p_user_id, v_org_id) THEN
    RETURN true;
  END IF;

  -- 2. Department Head has access
  IF v_dept_head = p_user_id THEN
    RETURN true;
  END IF;

  -- 3. Leadership members with 'full_organization' or 'all_departments' visibility
  IF EXISTS (
    SELECT 1 FROM public.leadership_members
    WHERE org_id = v_org_id 
      AND user_id = p_user_id 
      AND is_active = true 
      AND visibility_level IN ('full_organization', 'all_departments')
  ) THEN
    RETURN true;
  END IF;

  -- 4. Explicit department membership in department_members
  IF EXISTS (
    SELECT 1 FROM public.department_members
    WHERE department_id = p_dept_id AND user_id = p_user_id
  ) THEN
    RETURN true;
  END IF;

  -- 5. Primary department assignment in user_organizations
  IF EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE org_id = v_org_id AND user_id = p_user_id AND department_id = p_dept_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. UPDATE CHAT CHANNEL ACCESS POLICY (EXTENDING EXISTING ENGINE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.check_can_view_channel(channel_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org_id UUID;
  v_project_id UUID;
  v_department_id UUID;
  v_type TEXT;
  v_created_by UUID;
BEGIN
  -- Get channel details
  SELECT org_id, project_id, department_id, type, created_by 
  INTO v_org_id, v_project_id, v_department_id, v_type, v_created_by
  FROM public.chat_channels
  WHERE id = channel_uuid;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- 1. Org-wide channels: visible to non-freelancers of the organization
  IF v_project_id IS NULL AND v_department_id IS NULL AND v_type IN ('org_general', 'org_announcement') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = v_org_id
        AND user_id = user_uuid
        AND role != 'freelancer'
    );
  END IF;

  -- 2. Department channels: visible to authorized department members & owners
  IF v_department_id IS NOT NULL OR v_type = 'department' THEN
    IF v_department_id IS NOT NULL THEN
      RETURN public.can_access_department(user_uuid, v_department_id);
    END IF;
  END IF;

  -- 3. Project channels: visible to project members (including freelancers)
  IF v_project_id IS NOT NULL AND v_type = 'project' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = v_project_id
        AND user_id = user_uuid
    );
  END IF;

  -- 4. Private channels and DMs: visible only to explicit channel members OR the creator
  RETURN (
    v_created_by = user_uuid
    OR EXISTS (
      SELECT 1 FROM public.channel_members
      WHERE channel_id = channel_uuid AND user_id = user_uuid
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. ATOMIC MANAGEMENT RPCS
-- ------------------------------------------------------------------------------

-- 6.1 Appoint Organization Owner (Supports Multiple Equal-Authority Owners)
CREATE OR REPLACE FUNCTION public.appoint_organization_owner(
  p_org_id uuid,
  p_target_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_is_owner boolean;
  v_target_name text;
  v_target_email text;
  v_org_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Caller must be an active Owner of this organization
  v_caller_is_owner := public.is_org_owner(v_caller_id, p_org_id);
  IF NOT COALESCE(v_caller_is_owner, false) THEN
    RAISE EXCEPTION 'Access denied. Only an active Organization Owner can appoint co-owners.' USING ERRCODE = '42501';
  END IF;

  -- Verify target is a member of this organization
  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations WHERE org_id = p_org_id AND user_id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'The specified user is not a member of this organization.' USING ERRCODE = 'P0002';
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = p_org_id;
  SELECT full_name, email INTO v_target_name, v_target_email FROM public.users WHERE id = p_target_user_id;

  -- Upsert into organization_owners
  INSERT INTO public.organization_owners (
    org_id, user_id, appointed_by, appointed_at, status, notes
  ) VALUES (
    p_org_id, p_target_user_id, v_caller_id, now(), 'active', COALESCE(p_notes, 'Appointed as Co-Owner')
  )
  ON CONFLICT (org_id, user_id) 
  DO UPDATE SET 
    status = 'active',
    appointed_by = v_caller_id,
    appointed_at = now(),
    notes = COALESCE(p_notes, organization_owners.notes),
    updated_at = now();

  -- Synchronize user_organizations role to 'owner'
  UPDATE public.user_organizations
  SET role = 'owner'
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- Audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'owner_appointed', 'organization_owners', p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_name', v_target_name,
      'target_email', v_target_email,
      'appointed_by', v_caller_id
    )
  );

  -- Notification
  INSERT INTO public.notifications (
    user_id, title, message, type, entity_type, entity_id
  ) VALUES (
    p_target_user_id,
    'Appointed as Organization Owner',
    format('You have been appointed as an Organization Owner of %s with full organizational authority.', v_org_name),
    'owner_appointed',
    'organization',
    p_org_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully appointed %s as an Organization Owner.', COALESCE(v_target_name, v_target_email, 'member')),
    'org_id', p_org_id,
    'user_id', p_target_user_id
  );
END;
$$;

-- 6.2 Remove Organization Owner (With Last-Owner Protection)
CREATE OR REPLACE FUNCTION public.remove_organization_owner(
  p_org_id uuid,
  p_target_user_id uuid,
  p_new_role text DEFAULT 'administrator'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_active_owner_count int;
  v_target_name text;
  v_clean_new_role varchar;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_org_owner(v_caller_id, p_org_id) THEN
    RAISE EXCEPTION 'Access denied. Only an active Organization Owner can manage owner appointments.' USING ERRCODE = '42501';
  END IF;

  -- Prevent accidental loss of all owners: count remaining active owners
  SELECT COUNT(*) INTO v_active_owner_count
  FROM public.organization_owners
  WHERE org_id = p_org_id AND status = 'active';

  IF v_active_owner_count <= 1 AND EXISTS (
    SELECT 1 FROM public.organization_owners 
    WHERE org_id = p_org_id AND user_id = p_target_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Safety Violation: Cannot remove the only remaining active Owner of the organization.' USING ERRCODE = '23514';
  END IF;

  v_clean_new_role := LOWER(TRIM(COALESCE(p_new_role, 'administrator')));
  IF v_clean_new_role NOT IN ('administrator', 'manager', 'team_lead', 'team_member') THEN
    v_clean_new_role := 'administrator';
  END IF;

  SELECT full_name INTO v_target_name FROM public.users WHERE id = p_target_user_id;

  -- Update status in organization_owners
  UPDATE public.organization_owners
  SET status = 'removed', updated_at = now()
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- Update user_organizations
  UPDATE public.user_organizations
  SET role = v_clean_new_role
  WHERE org_id = p_org_id AND user_id = p_target_user_id;

  -- If target was organizations.owner_id, reassign owner_id to another active owner
  UPDATE public.organizations
  SET owner_id = (
    SELECT user_id FROM public.organization_owners 
    WHERE org_id = p_org_id AND status = 'active' AND user_id != p_target_user_id 
    LIMIT 1
  )
  WHERE id = p_org_id AND owner_id = p_target_user_id;

  -- Audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'owner_removed', 'organization_owners', p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'new_role', v_clean_new_role,
      'removed_by', v_caller_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully adjusted ownership status for %s. New role: %s.', COALESCE(v_target_name, 'member'), v_clean_new_role),
    'org_id', p_org_id,
    'user_id', p_target_user_id
  );
END;
$$;

-- 6.3 Upsert Leadership Team Member
CREATE OR REPLACE FUNCTION public.upsert_leadership_member(
  p_org_id uuid,
  p_target_user_id uuid,
  p_designation text,
  p_department_id uuid DEFAULT NULL,
  p_reporting_to_user_id uuid DEFAULT NULL,
  p_visibility_level text DEFAULT 'department',
  p_can_manage_depts boolean DEFAULT false,
  p_can_manage_leadership boolean DEFAULT false,
  p_can_manage_announcements boolean DEFAULT true,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_clean_designation text;
  v_target_name text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Check authority: Must be Owner OR have can_manage_leadership flag
  IF NOT (
    public.is_org_owner(v_caller_id, p_org_id)
    OR EXISTS (
      SELECT 1 FROM public.leadership_members
      WHERE org_id = p_org_id AND user_id = v_caller_id AND is_active = true AND can_manage_leadership = true
    )
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to manage leadership appointments.' USING ERRCODE = '42501';
  END IF;

  v_clean_designation := TRIM(p_designation);
  IF v_clean_designation IS NULL OR v_clean_designation = '' THEN
    RAISE EXCEPTION 'Leadership designation cannot be empty.' USING ERRCODE = '22023';
  END IF;

  SELECT full_name INTO v_target_name FROM public.users WHERE id = p_target_user_id;

  INSERT INTO public.leadership_members (
    org_id, user_id, designation, department_id, reporting_to_user_id,
    visibility_level, can_manage_departments, can_manage_leadership,
    can_manage_announcements, is_active, appointed_by, appointed_at, notes
  ) VALUES (
    p_org_id, p_target_user_id, v_clean_designation, p_department_id, p_reporting_to_user_id,
    COALESCE(p_visibility_level, 'department'),
    COALESCE(p_can_manage_depts, false),
    COALESCE(p_can_manage_leadership, false),
    COALESCE(p_can_manage_announcements, true),
    true, v_caller_id, now(), p_notes
  )
  ON CONFLICT (org_id, user_id)
  DO UPDATE SET
    designation = v_clean_designation,
    department_id = p_department_id,
    reporting_to_user_id = p_reporting_to_user_id,
    visibility_level = COALESCE(p_visibility_level, leadership_members.visibility_level),
    can_manage_departments = COALESCE(p_can_manage_depts, leadership_members.can_manage_departments),
    can_manage_leadership = COALESCE(p_can_manage_leadership, leadership_members.can_manage_leadership),
    can_manage_announcements = COALESCE(p_can_manage_announcements, leadership_members.can_manage_announcements),
    is_active = true,
    notes = COALESCE(p_notes, leadership_members.notes),
    updated_at = now();

  -- Audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    p_org_id, v_caller_id, 'leadership_appointed', 'leadership_members', p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'designation', v_clean_designation,
      'visibility_level', p_visibility_level
    )
  );

  -- Notification
  INSERT INTO public.notifications (
    user_id, title, message, type, entity_type, entity_id
  ) VALUES (
    p_target_user_id,
    'Leadership Appointment Updated',
    format('You have been appointed as %s in the leadership team.', v_clean_designation),
    'leadership_appointed',
    'leadership_member',
    p_target_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully updated leadership profile for %s (%s).', COALESCE(v_target_name, 'member'), v_clean_designation)
  );
END;
$$;

-- 6.4 Assign Department Member & Auto-Sync
CREATE OR REPLACE FUNCTION public.assign_department_member(
  p_department_id uuid,
  p_target_user_id uuid,
  p_department_role text DEFAULT 'member',
  p_is_primary boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_org_id uuid;
  v_dept_name text;
  v_channel_id uuid;
  v_role_clean text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, name INTO v_org_id, v_dept_name
  FROM public.departments
  WHERE id = p_department_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Department not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Validate authority
  IF NOT (
    public.is_org_owner(v_caller_id, v_org_id)
    OR EXISTS (
      SELECT 1 FROM public.departments WHERE id = p_department_id AND head_user_id = v_caller_id
    )
    OR EXISTS (
      SELECT 1 FROM public.leadership_members WHERE org_id = v_org_id AND user_id = v_caller_id AND can_manage_departments = true
    )
    OR public.has_org_permission(v_caller_id, v_org_id, 'departments.manage')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to assign department members.' USING ERRCODE = '42501';
  END IF;

  v_role_clean := LOWER(TRIM(COALESCE(p_department_role, 'member')));
  IF v_role_clean NOT IN ('head', 'lead', 'member') THEN
    v_role_clean := 'member';
  END IF;

  -- 1. Insert/Update department_members
  INSERT INTO public.department_members (
    department_id, user_id, org_id, department_role, is_primary, assigned_by
  ) VALUES (
    p_department_id, p_target_user_id, v_org_id, v_role_clean, COALESCE(p_is_primary, true), v_caller_id
  )
  ON CONFLICT (department_id, user_id)
  DO UPDATE SET
    department_role = v_role_clean,
    is_primary = COALESCE(p_is_primary, department_members.is_primary),
    updated_at = now();

  -- 2. If primary, sync user_organizations.department_id
  IF COALESCE(p_is_primary, true) THEN
    UPDATE public.user_organizations
    SET department_id = p_department_id
    WHERE org_id = v_org_id AND user_id = p_target_user_id;

    UPDATE public.users
    SET department = v_dept_name
    WHERE id = p_target_user_id;
  END IF;

  -- 3. If role is 'head', set departments.head_user_id
  IF v_role_clean = 'head' THEN
    UPDATE public.departments
    SET head_user_id = p_target_user_id
    WHERE id = p_department_id;
  END IF;

  -- 4. Automatically add member to department chat channel
  SELECT id INTO v_channel_id
  FROM public.chat_channels
  WHERE department_id = p_department_id
  LIMIT 1;

  IF v_channel_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id, role)
    VALUES (v_channel_id, p_target_user_id, 'member')
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  -- 5. Notification
  INSERT INTO public.notifications (
    user_id, title, message, type, entity_type, entity_id
  ) VALUES (
    p_target_user_id,
    'Assigned to Department',
    format('You have been assigned to the %s department as %s.', v_dept_name, v_role_clean),
    'department_assigned',
    'department',
    p_department_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully added member to %s.', v_dept_name),
    'department_id', p_department_id,
    'user_id', p_target_user_id
  );
END;
$$;

-- 6.5 Transfer Department Member
CREATE OR REPLACE FUNCTION public.transfer_department_member(
  p_from_department_id uuid,
  p_to_department_id uuid,
  p_target_user_id uuid,
  p_new_department_role text DEFAULT 'member'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_org_id uuid;
  v_to_dept_name text;
  v_from_channel_id uuid;
  v_to_channel_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT org_id, name INTO v_org_id, v_to_dept_name
  FROM public.departments WHERE id = p_to_department_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination department not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Validate authority
  IF NOT (
    public.is_org_owner(v_caller_id, v_org_id)
    OR EXISTS (
      SELECT 1 FROM public.leadership_members WHERE org_id = v_org_id AND user_id = v_caller_id AND can_manage_departments = true
    )
    OR public.has_org_permission(v_caller_id, v_org_id, 'departments.manage')
  ) THEN
    RAISE EXCEPTION 'Access denied. You do not have permission to transfer department members.' USING ERRCODE = '42501';
  END IF;

  -- Remove from source department_members
  DELETE FROM public.department_members
  WHERE department_id = p_from_department_id AND user_id = p_target_user_id;

  -- Add to target department_members
  INSERT INTO public.department_members (
    department_id, user_id, org_id, department_role, is_primary, assigned_by
  ) VALUES (
    p_to_department_id, p_target_user_id, v_org_id, COALESCE(p_new_department_role, 'member'), true, v_caller_id
  )
  ON CONFLICT (department_id, user_id)
  DO UPDATE SET
    department_role = COALESCE(p_new_department_role, 'member'),
    is_primary = true,
    updated_at = now();

  -- Update primary department in user_organizations
  UPDATE public.user_organizations
  SET department_id = p_to_department_id
  WHERE org_id = v_org_id AND user_id = p_target_user_id;

  UPDATE public.users
  SET department = v_to_dept_name
  WHERE id = p_target_user_id;

  -- Switch chat channel membership
  SELECT id INTO v_from_channel_id FROM public.chat_channels WHERE department_id = p_from_department_id;
  SELECT id INTO v_to_channel_id FROM public.chat_channels WHERE department_id = p_to_department_id;

  IF v_from_channel_id IS NOT NULL THEN
    DELETE FROM public.channel_members WHERE channel_id = v_from_channel_id AND user_id = p_target_user_id;
  END IF;

  IF v_to_channel_id IS NOT NULL THEN
    INSERT INTO public.channel_members (channel_id, user_id, role)
    VALUES (v_to_channel_id, p_target_user_id, 'member')
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  -- Audit log
  INSERT INTO public.activity_logs (
    org_id, actor_id, action, entity_type, entity_id, new_value
  ) VALUES (
    v_org_id, v_caller_id, 'member_department_transferred', 'department_members', p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'from_department_id', p_from_department_id,
      'to_department_id', p_to_department_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully transferred member to %s.', v_to_dept_name)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.organization_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leadership_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_announcements ENABLE ROW LEVEL SECURITY;

-- 7.1 organization_owners
DROP POLICY IF EXISTS "Members can view organization owners" ON public.organization_owners;
CREATE POLICY "Members can view organization owners"
ON public.organization_owners FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = organization_owners.org_id AND uo.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can manage organization owners" ON public.organization_owners;
CREATE POLICY "Owners can manage organization owners"
ON public.organization_owners FOR ALL
USING (public.is_org_owner(auth.uid(), org_id))
WITH CHECK (public.is_org_owner(auth.uid(), org_id));

-- 7.2 leadership_members
DROP POLICY IF EXISTS "Members can view leadership team" ON public.leadership_members;
CREATE POLICY "Members can view leadership team"
ON public.leadership_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = leadership_members.org_id AND uo.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners and leadership admins can manage leadership" ON public.leadership_members;
CREATE POLICY "Owners and leadership admins can manage leadership"
ON public.leadership_members FOR ALL
USING (
  public.is_org_owner(auth.uid(), org_id)
  OR EXISTS (
    SELECT 1 FROM public.leadership_members lm
    WHERE lm.org_id = leadership_members.org_id AND lm.user_id = auth.uid() AND lm.is_active = true AND lm.can_manage_leadership = true
  )
)
WITH CHECK (
  public.is_org_owner(auth.uid(), org_id)
  OR EXISTS (
    SELECT 1 FROM public.leadership_members lm
    WHERE lm.org_id = leadership_members.org_id AND lm.user_id = auth.uid() AND lm.is_active = true AND lm.can_manage_leadership = true
  )
);

-- 7.3 department_members
DROP POLICY IF EXISTS "Members can view department members" ON public.department_members;
CREATE POLICY "Members can view department members"
ON public.department_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.org_id = department_members.org_id AND uo.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authorized users can manage department members" ON public.department_members;
CREATE POLICY "Authorized users can manage department members"
ON public.department_members FOR ALL
USING (
  public.is_org_owner(auth.uid(), org_id)
  OR EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = department_members.department_id AND d.head_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.leadership_members lm
    WHERE lm.org_id = department_members.org_id AND lm.user_id = auth.uid() AND lm.is_active = true AND lm.can_manage_departments = true
  )
)
WITH CHECK (
  public.is_org_owner(auth.uid(), org_id)
  OR EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = department_members.department_id AND d.head_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.leadership_members lm
    WHERE lm.org_id = department_members.org_id AND lm.user_id = auth.uid() AND lm.is_active = true AND lm.can_manage_departments = true
  )
);

-- 7.4 department_announcements
DROP POLICY IF EXISTS "Authorized members can view department announcements" ON public.department_announcements;
CREATE POLICY "Authorized members can view department announcements"
ON public.department_announcements FOR SELECT
USING (public.can_access_department(auth.uid(), department_id));

DROP POLICY IF EXISTS "Authorized leaders can manage department announcements" ON public.department_announcements;
CREATE POLICY "Authorized leaders can manage department announcements"
ON public.department_announcements FOR ALL
USING (
  public.is_org_owner(auth.uid(), org_id)
  OR author_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = department_announcements.department_id AND d.head_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.leadership_members lm
    WHERE lm.org_id = department_announcements.org_id AND lm.user_id = auth.uid() AND lm.is_active = true AND lm.can_manage_announcements = true
  )
)
WITH CHECK (
  public.is_org_owner(auth.uid(), org_id)
  OR author_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = department_announcements.department_id AND d.head_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.leadership_members lm
    WHERE lm.org_id = department_announcements.org_id AND lm.user_id = auth.uid() AND lm.is_active = true AND lm.can_manage_announcements = true
  )
);

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_department(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.appoint_organization_owner(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_organization_owner(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_leadership_member(uuid, uuid, text, uuid, uuid, text, boolean, boolean, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_department_member(uuid, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_department_member(uuid, uuid, uuid, text) TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
