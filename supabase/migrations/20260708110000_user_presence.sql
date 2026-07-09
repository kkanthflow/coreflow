-- Migration to add presence and last seen columns to users table

-- 1. Add columns to public.users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- 2. Safely add public.users to the realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
