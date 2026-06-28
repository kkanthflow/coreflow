-- ============================================================
-- CoreFlow Chat Enhancements: E2EE & Privacy Controls
-- ============================================================

-- 1. User Public Keys (for asymmetric key exchange)
CREATE TABLE IF NOT EXISTS public.user_public_keys (
  user_id      UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  public_key   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Channel Keys (encrypted symmetric channel keys per member)
CREATE TABLE IF NOT EXISTS public.channel_keys (
  channel_id   UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- 3. Privacy Settings
CREATE TABLE IF NOT EXISTS public.privacy_settings (
  user_id      UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  show_online  TEXT NOT NULL DEFAULT 'everyone' CHECK (show_online IN ('everyone', 'contacts', 'nobody')),
  show_last_seen TEXT NOT NULL DEFAULT 'everyone' CHECK (show_last_seen IN ('everyone', 'contacts', 'nobody')),
  enable_read_receipts BOOLEAN DEFAULT true,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. User Blocks
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- 5. Channel Mutes
CREATE TABLE IF NOT EXISTS public.channel_mutes (
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_id   UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  muted_until  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.user_public_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_mutes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- User Public Keys
DROP POLICY IF EXISTS "Anyone can view public keys" ON public.user_public_keys;
CREATE POLICY "Anyone can view public keys"
  ON public.user_public_keys FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can manage own public key" ON public.user_public_keys;
CREATE POLICY "Users can manage own public key"
  ON public.user_public_keys FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

-- Channel Keys
DROP POLICY IF EXISTS "Users can read own channel keys" ON public.channel_keys;
CREATE POLICY "Users can read own channel keys"
  ON public.channel_keys FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

DROP POLICY IF EXISTS "Members can insert channel keys" ON public.channel_keys;
CREATE POLICY "Members can insert channel keys"
  ON public.channel_keys FOR INSERT
  TO authenticated
  WITH CHECK (true); -- allowed to insert keys encrypted for any member

-- Privacy Settings
DROP POLICY IF EXISTS "Users can manage own privacy settings" ON public.privacy_settings;
CREATE POLICY "Users can manage own privacy settings"
  ON public.privacy_settings FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

DROP POLICY IF EXISTS "Anyone can read privacy settings" ON public.privacy_settings;
CREATE POLICY "Anyone can read privacy settings"
  ON public.privacy_settings FOR SELECT
  TO authenticated
  USING (true);

-- User Blocks
DROP POLICY IF EXISTS "Users can manage own blocks" ON public.user_blocks;
CREATE POLICY "Users can manage own blocks"
  ON public.user_blocks FOR ALL
  TO authenticated
  USING (blocker_id = (select auth.uid())::uuid);

-- Channel Mutes
DROP POLICY IF EXISTS "Users can manage own mutes" ON public.channel_mutes;
CREATE POLICY "Users can manage own mutes"
  ON public.channel_mutes FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

-- Enable Realtime publication additions safely
DO $$
BEGIN
  -- Add new tables to Realtime publication if they exist and are not already added
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_public_keys') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_public_keys') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_public_keys;
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'privacy_settings') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'privacy_settings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.privacy_settings;
      END IF;
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
