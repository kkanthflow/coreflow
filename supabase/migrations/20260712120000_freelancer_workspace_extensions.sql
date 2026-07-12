-- 1. Alter users table to add freelancer profile fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS freelancer_type VARCHAR(50) DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS default_workspace_id VARCHAR(50) DEFAULT 'independent';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS availability VARCHAR(50) DEFAULT 'available';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS portfolio TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending';

-- 2. Drop NOT NULL constraint on projects.org_id to allow independent freelancer projects
ALTER TABLE public.projects ALTER COLUMN org_id DROP NOT NULL;

-- 3. Create workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('organization', 'independent', 'external', 'guest', 'archived')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived', 'deleted')),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create workspace_members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, user_id)
);

-- 5. Create workspace_roles table
CREATE TABLE IF NOT EXISTS public.workspace_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  scope VARCHAR(50) NOT NULL CHECK (scope IN ('workspace', 'department', 'project')),
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, scope)
);

-- 6. Create workspace_member_roles table
CREATE TABLE IF NOT EXISTS public.workspace_member_roles (
  workspace_member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.workspace_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (workspace_member_id, role_id)
);

-- 7. Create workspace_role_permissions table
CREATE TABLE IF NOT EXISTS public.workspace_role_permissions (
  role_id UUID NOT NULL REFERENCES public.workspace_roles(id) ON DELETE CASCADE,
  permission VARCHAR(255) NOT NULL,
  PRIMARY KEY (role_id, permission)
);

-- 8. Create member_assignments table
CREATE TABLE IF NOT EXISTS public.member_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.workspace_members(id) ON DELETE CASCADE,
  scope_type VARCHAR(50) NOT NULL CHECK (scope_type IN ('workspace', 'department', 'project')),
  scope_id UUID NOT NULL, -- references workspace_id, department_id, or project_id
  role_id UUID NOT NULL REFERENCES public.workspace_roles(id) ON DELETE CASCADE
);

-- 9. Create workspace_features table
CREATE TABLE IF NOT EXISTS public.workspace_features (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  plan_required VARCHAR(50) DEFAULT 'free',
  PRIMARY KEY (workspace_id, feature_key)
);

-- 10. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  device TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Create freelancer_profiles table
CREATE TABLE IF NOT EXISTS public.freelancer_profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  freelancer_type VARCHAR(50) DEFAULT 'independent',
  hourly_rate NUMERIC DEFAULT 0,
  availability VARCHAR(50) DEFAULT 'available',
  portfolio TEXT DEFAULT '',
  skills TEXT[] DEFAULT '{}',
  verification_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_member_assign_scope ON public.member_assignments(scope_type, scope_id);

-- 12. Enable RLS on all tables (Secures against Supabase warnings)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;

-- 13. Security Policies
DROP POLICY IF EXISTS "Users can view workspaces they own or belong to" ON public.workspaces;
CREATE POLICY "Users can view workspaces they own or belong to"
  ON public.workspaces FOR SELECT
  USING (
    owner_id = auth.uid()::uuid OR
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = workspaces.id AND user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can view workspace memberships" ON public.workspace_members;
CREATE POLICY "Users can view workspace memberships"
  ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid()::uuid OR
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id AND wm.user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Workspace roles are viewable by authenticated users" ON public.workspace_roles;
CREATE POLICY "Workspace roles are viewable by authenticated users"
  ON public.workspace_roles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Workspace member roles are viewable by workspace members" ON public.workspace_member_roles;
CREATE POLICY "Workspace member roles are viewable by workspace members"
  ON public.workspace_member_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.id = workspace_member_roles.workspace_member_id AND wm.user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Workspace role permissions are viewable by authenticated users" ON public.workspace_role_permissions;
CREATE POLICY "Workspace role permissions are viewable by authenticated users"
  ON public.workspace_role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Member assignments are viewable by workspace members" ON public.member_assignments;
CREATE POLICY "Member assignments are viewable by workspace members"
  ON public.member_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.id = member_assignments.member_id AND wm.user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Workspace features are viewable by workspace members" ON public.workspace_features;
CREATE POLICY "Workspace features are viewable by workspace members"
  ON public.workspace_features FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_features.workspace_id AND wm.user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Audit logs are viewable by workspace managers/owners" ON public.audit_logs;
CREATE POLICY "Audit logs are viewable by workspace managers/owners"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = audit_logs.workspace_id AND wm.user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Freelancer profiles are readable by authenticated users" ON public.freelancer_profiles;
CREATE POLICY "Freelancer profiles are readable by authenticated users"
  ON public.freelancer_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- 14. Backfill data logic
DO $$
DECLARE
  u RECORD;
  o RECORD;
  uo RECORD;
  new_ws_id UUID;
  new_member_id UUID;
BEGIN
  -- Create personal independent workspaces for all users
  FOR u IN SELECT id, full_name, email FROM public.users LOOP
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE owner_id = u.id AND type = 'independent') THEN
      INSERT INTO public.workspaces (name, type, owner_id, status)
      VALUES (COALESCE(u.full_name, 'My') || ' Freelancing', 'independent', u.id, 'active')
      RETURNING id INTO new_ws_id;

      INSERT INTO public.workspace_members (workspace_id, user_id, status)
      VALUES (new_ws_id, u.id, 'active');
    END IF;

    -- Create freelancer profile if role is freelancer
    IF NOT EXISTS (SELECT 1 FROM public.freelancer_profiles WHERE id = u.id) THEN
      INSERT INTO public.freelancer_profiles (id, freelancer_type)
      VALUES (u.id, 'independent');
    END IF;
  END LOOP;

  -- Create organization workspaces for existing organizations
  FOR o IN SELECT id, name FROM public.organizations LOOP
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE organization_id = o.id AND type = 'organization') THEN
      -- Pick owner or first member as owner
      SELECT user_id INTO new_member_id FROM public.user_organizations WHERE org_id = o.id LIMIT 1;
      IF new_member_id IS NULL THEN
        SELECT id INTO new_member_id FROM public.users LIMIT 1;
      END IF;

      IF new_member_id IS NOT NULL THEN
        INSERT INTO public.workspaces (name, type, owner_id, organization_id, status)
        VALUES (o.name || ' Organization', 'organization', new_member_id, o.id, 'active')
        RETURNING id INTO new_ws_id;

        -- Add all members
        FOR uo IN SELECT user_id FROM public.user_organizations WHERE org_id = o.id LOOP
          INSERT INTO public.workspace_members (workspace_id, user_id, status)
          VALUES (new_ws_id, uo.user_id, 'active')
          ON CONFLICT (workspace_id, user_id) DO NOTHING;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END;
$$;
