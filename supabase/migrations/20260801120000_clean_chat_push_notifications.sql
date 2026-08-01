-- 20260801120000_clean_chat_push_notifications.sql

-- Update trigger function to insert in-app notifications for chat messages
-- and rely entirely on on_new_notification_inserted() for push delivery.
CREATE OR REPLACE FUNCTION public.on_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_member RECORD;
  sender_name TEXT;
  message_preview TEXT;
  channel_name TEXT;
BEGIN
  -- Get sender's full name
  SELECT full_name INTO sender_name FROM public.users WHERE id = NEW.sender_id;
  IF sender_name IS NULL THEN
    sender_name := 'Someone';
  END IF;

  -- Prepare message preview
  IF NEW.content LIKE '__E2EE__:%' THEN
    message_preview := '🔒 Encrypted Message';
  ELSE
    message_preview := substring(NEW.content from 1 for 100);
  END IF;

  -- Get channel details
  SELECT name INTO channel_name FROM public.chat_channels WHERE id = NEW.channel_id;

  -- 1. Insert in-app notifications for all channel members except the sender.
  -- This will automatically trigger tr_push_notification_on_insert 
  -- which will route the push notification to the Vercel Firebase backend.
  FOR recipient_member IN
    SELECT DISTINCT user_id 
    FROM public.channel_members 
    WHERE channel_id = NEW.channel_id 
      AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read, sender_id)
    VALUES (
      recipient_member.user_id,
      sender_name,
      message_preview,
      'chat',
      NEW.channel_id,
      'chat',
      '/chat/' || NEW.channel_id::TEXT,
      FALSE,
      NEW.sender_id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.on_new_chat_message() SET search_path = public, pg_temp;

NOTIFY pgrst, 'reload schema';
