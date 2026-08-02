-- 20260802130000_enable_realtime_message_reads.sql

-- Enable realtime subscriptions for the message_reads table
-- This allows the frontend to instantly receive 'Seen' indicators when another user reads a message.

DO $$
BEGIN
  -- Ensure the realtime publication exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add the message_reads table to the publication if it's not already in it
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'message_reads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
  END IF;
END;
$$;
