-- 20260801100000_fix_notifications_and_meetings.sql

-- 1. Fix notifications INSERT policy
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid())::uuid OR sender_id = (select auth.uid())::uuid);

-- 2. Create is_host_of_meeting function to prevent recursion in meeting_participants
CREATE OR REPLACE FUNCTION public.is_host_of_meeting(user_uuid UUID, m_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_host BOOLEAN;
BEGIN
  -- Check if they are the creator/host of the meeting
  SELECT EXISTS(
    SELECT 1 FROM public.meetings WHERE id = m_id AND host_id = user_uuid
  ) INTO is_host;
  
  IF is_host THEN
    RETURN TRUE;
  END IF;

  -- Check if they are assigned the host role in meeting_participants
  SELECT EXISTS(
    SELECT 1 FROM public.meeting_participants WHERE meeting_id = m_id AND user_id = user_uuid AND role = 'host'
  ) INTO is_host;
  
  RETURN COALESCE(is_host, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update meeting_participants update policy
DROP POLICY IF EXISTS "Hosts can update participants" ON public.meeting_participants;
CREATE POLICY "Hosts can update participants" ON public.meeting_participants FOR UPDATE
  TO authenticated
  USING (public.is_host_of_meeting((select auth.uid())::uuid, meeting_id));

-- 4. Restore push notifications to use Vercel Backend
CREATE OR REPLACE FUNCTION public.on_new_notification_inserted()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://coreflow-one.vercel.app/api/notifications/send-push',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer cf_internal_push_secret_2026'
    )::jsonb,
    body := json_build_object(
      'id',          NEW.id,
      'user_id',     NEW.user_id,
      'title',       NEW.title,
      'message',     NEW.message,
      'type',        COALESCE(NEW.type, 'general'),
      'entity_type', COALESCE(NEW.entity_type, ''),
      'entity_id',   COALESCE(NEW.entity_id::TEXT, ''),
      'action_url',  COALESCE(NEW.action_url, ''),
      'sender_id',   COALESCE(NEW.sender_id::TEXT, '')
    )::jsonb,
    timeout_ms := 3000
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.on_new_notification_inserted() SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.on_new_notification_inserted () TO authenticated, service_role;
