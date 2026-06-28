-- 1. Resolve auth_rls_initplan warnings by wrapping auth functions in (select auth.<func>())
-- Also resolves multiple_permissive_policies by consolidating overlapping policies.

----------------------------------------------------
-- Table: public.organizations
----------------------------------------------------
-- Consolidate SELECT policies: Drop redundant ones, keep one clean "Anyone can view organizations"
DROP POLICY IF EXISTS "Anyone can view all organizations" ON public.organizations;
DROP POLICY IF EXISTS "Anyone can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can view all organizations" ON public.organizations;

CREATE POLICY "Anyone can view organizations" ON public.organizations
  FOR SELECT TO public
  USING (true);

-- Consolidate INSERT policies
DROP POLICY IF EXISTS "Any authenticated user can create an org" ON public.organizations;
DROP POLICY IF EXISTS "Anyone can create an org" ON public.organizations;

CREATE POLICY "Anyone can create an org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);


----------------------------------------------------
-- Table: public.project_members
----------------------------------------------------
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Org members can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Managers can manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view members of their project" ON public.project_members;

CREATE POLICY "Org members can view project members" ON public.project_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = (select auth.uid())
    )
  );

-- Consolidate INSERT policies
DROP POLICY IF EXISTS "Managers can assign project members" ON public.project_members;
DROP POLICY IF EXISTS "Managers can manage project members" ON public.project_members;

CREATE POLICY "Managers can assign project members" ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      JOIN public.users u ON u.id = uo.user_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = (select auth.uid())
        AND u.role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
    )
  );

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Managers can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Managers can manage project members" ON public.project_members;

CREATE POLICY "Managers can update project members" ON public.project_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_organizations uo ON uo.org_id = p.org_id
      JOIN public.users u ON u.id = uo.user_id
      WHERE p.id = project_members.project_id
        AND uo.user_id = (select auth.uid())
        AND u.role IN ('owner', 'administrator', 'director', 'senior_manager', 'manager')
    )
  );


----------------------------------------------------
-- Table: public.channel_members
----------------------------------------------------
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Users can see channel members" ON public.channel_members;
DROP POLICY IF EXISTS "Users can manage channel members" ON public.channel_members;

CREATE POLICY "Users can see channel members" ON public.channel_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
        AND cm.user_id = (select auth.uid())
    )
  );


----------------------------------------------------
-- Table: public.message_reads
----------------------------------------------------
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;
DROP POLICY IF EXISTS "Users can update message reads" ON public.message_reads;
DROP POLICY IF EXISTS "Users can insert message reads" ON public.message_reads;
DROP POLICY IF EXISTS "Users can delete message reads" ON public.message_reads;

CREATE POLICY "Users can view message reads" ON public.message_reads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.channel_members cm ON cm.channel_id = m.channel_id
      WHERE m.id = message_reads.message_id
        AND cm.user_id = (select auth.uid())
    )
  );

-- Split write operations to avoid SELECT overlap
CREATE POLICY "Users can insert message reads" ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid())::uuid);

CREATE POLICY "Users can update message reads" ON public.message_reads
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())::uuid);

CREATE POLICY "Users can delete message reads" ON public.message_reads
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid())::uuid);


----------------------------------------------------
-- Table: public.privacy_settings
----------------------------------------------------
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Anyone can read privacy settings" ON public.privacy_settings;
DROP POLICY IF EXISTS "Users can manage own privacy settings" ON public.privacy_settings;

CREATE POLICY "Anyone can read privacy settings" ON public.privacy_settings
  FOR SELECT TO authenticated
  USING (true);


----------------------------------------------------
-- Table: public.project_milestones
----------------------------------------------------
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Users can view milestones in their project" ON public.project_milestones;
DROP POLICY IF EXISTS "Managers can manage milestones" ON public.project_milestones;

CREATE POLICY "Users can view milestones in their project" ON public.project_milestones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_milestones.project_id
        AND pm.user_id = (select auth.uid())
    )
  );


----------------------------------------------------
-- Table: public.role_permissions
----------------------------------------------------
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Users can view own permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Owners can manage custom permissions" ON public.role_permissions;

CREATE POLICY "Users can view own permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));


----------------------------------------------------
-- Table: public.tasks
----------------------------------------------------
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Users can view tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Authorized roles can manage tasks" ON public.tasks;

CREATE POLICY "Users can view tasks in their org" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations uo
      WHERE uo.org_id = tasks.org_id
        AND uo.user_id = (select auth.uid())
    )
  );


----------------------------------------------------
-- Table: public.user_public_keys
----------------------------------------------------
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Anyone can view public keys" ON public.user_public_keys;
DROP POLICY IF EXISTS "Users can manage own public key" ON public.user_public_keys;

CREATE POLICY "Anyone can view public keys" ON public.user_public_keys
  FOR SELECT TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
