-- ============================================================
-- CoreFlow Enterprise — Phase 3: Chat System
-- ============================================================

-- 1. Chat Channels table
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id   UUID REFERENCES public.projects(id) ON DELETE CASCADE, -- NULL = org channel
  name         TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL CHECK (type IN ('org_general','org_announcement','project','direct')),
  is_private   BOOLEAN DEFAULT false,
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Channel Members table (for DMs and private/project channels)
CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id   UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- 3. Chat Messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content      TEXT,
  file_url     TEXT,
  file_name    TEXT,
  file_type    TEXT,
  reply_to_id  UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_edited    BOOLEAN DEFAULT false,
  edited_at    TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ, -- soft delete
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Message Reads table
CREATE TABLE IF NOT EXISTS public.message_reads (
  message_id   UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_channels_org ON public.chat_channels(org_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_project ON public.chat_channels(project_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON public.chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON public.message_reads(user_id);

-- Enable RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- RLS Policies
-- ────────────────────────────────────────────────────────────

-- CHAT CHANNELS
DROP POLICY IF EXISTS "Users can view channels they belong to" ON public.chat_channels;
CREATE POLICY "Users can view channels they belong to"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (
    -- Org-wide channels: visible to non-freelancers of the organization
    (project_id IS NULL AND type IN ('org_general', 'org_announcement') AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = chat_channels.org_id
        AND user_id = (select auth.uid())::uuid
        AND role != 'freelancer'
    ))
    -- Project channels: visible to project members (including freelancers)
    OR (project_id IS NOT NULL AND type = 'project' AND EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = chat_channels.project_id
        AND user_id = (select auth.uid())::uuid
    ))
    -- Private channels and DMs: visible only to explicit channel members
    OR EXISTS (
      SELECT 1 FROM public.channel_members
      WHERE channel_id = chat_channels.id
        AND user_id = (select auth.uid())::uuid
    )
  );

DROP POLICY IF EXISTS "Authorized members can create channels" ON public.chat_channels;
CREATE POLICY "Authorized members can create channels"
  ON public.chat_channels FOR INSERT
  TO authenticated
  WITH CHECK (
    -- DMs and general creation: must be in same org
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE org_id = chat_channels.org_id
        AND user_id = (select auth.uid())::uuid
        AND role != 'freelancer'
    )
  );

-- CHANNEL MEMBERS
DROP POLICY IF EXISTS "Users can see channel members" ON public.channel_members;
CREATE POLICY "Users can see channel members"
  ON public.channel_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = channel_members.channel_id
    )
  );

DROP POLICY IF EXISTS "Users can manage channel members" ON public.channel_members;
CREATE POLICY "Users can manage channel members"
  ON public.channel_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = channel_members.channel_id
        AND org_id IN (
          SELECT org_id FROM public.user_organizations
          WHERE user_id = (select auth.uid())::uuid
        )
    )
  );

-- CHAT MESSAGES
DROP POLICY IF EXISTS "Users can read channel messages" ON public.chat_messages;
CREATE POLICY "Users can read channel messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = chat_messages.channel_id
    )
  );

DROP POLICY IF EXISTS "Users can send channel messages" ON public.chat_messages;
CREATE POLICY "Users can send channel messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())::uuid
    AND EXISTS (
      SELECT 1 FROM public.chat_channels
      WHERE id = channel_id
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;
CREATE POLICY "Users can update own messages"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (sender_id = (select auth.uid())::uuid);

-- MESSAGE READS
DROP POLICY IF EXISTS "Users can view message reads" ON public.message_reads;
CREATE POLICY "Users can view message reads"
  ON public.message_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages
      WHERE id = message_reads.message_id
    )
  );

DROP POLICY IF EXISTS "Users can update message reads" ON public.message_reads;
CREATE POLICY "Users can update message reads"
  ON public.message_reads FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

-- ────────────────────────────────────────────────────────────
-- Triggers
-- ────────────────────────────────────────────────────────────

-- 1. Auto-create Org Chat channels on Org Creation
CREATE OR REPLACE FUNCTION public.create_default_org_channels()
RETURNS trigger AS $$
BEGIN
  -- Create general channel
  INSERT INTO public.chat_channels (org_id, name, description, type)
  VALUES (
    new.id,
    'general',
    'Company-wide discussions and general chat',
    'org_general'
  );

  -- Create announcements channel
  INSERT INTO public.chat_channels (org_id, name, description, type)
  VALUES (
    new.id,
    'announcements',
    'Company updates and announcements',
    'org_announcement'
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_created ON public.organizations;
CREATE TRIGGER on_org_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE PROCEDURE public.create_default_org_channels();

-- 2. Auto-create Project Chat channel on Project Creation
CREATE OR REPLACE FUNCTION public.create_project_channel()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.chat_channels (org_id, project_id, name, description, type)
  VALUES (
    new.org_id,
    new.id,
    'project-' || lower(replace(new.title, ' ', '-')),
    'Chat channel for project: ' || new.title,
    'project'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE PROCEDURE public.create_project_channel();

-- Enable Realtime publication for chat tables safely
DO $$
BEGIN
  -- Check if supabase_realtime publication exists, create it if not
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add chat_channels if it exists and is not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_channels') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND c.relname = 'chat_channels'
        AND n.nspname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
    END IF;
  END IF;

  -- Add channel_members if it exists and is not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'channel_members') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND c.relname = 'channel_members'
        AND n.nspname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
    END IF;
  END IF;

  -- Add chat_messages if it exists and is not already added
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE pr.prpubid = (SELECT oid FROM pg_publication WHERE pubname = 'supabase_realtime')
        AND c.relname = 'chat_messages'
        AND n.nspname = 'public'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
