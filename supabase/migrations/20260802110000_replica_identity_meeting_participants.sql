-- Set replica identity to full so Realtime can see meeting_id and user_id on UPDATE events
ALTER TABLE public.meeting_participants REPLICA IDENTITY FULL;
