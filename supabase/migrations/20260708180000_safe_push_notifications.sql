-- Harden push notification triggers to prevent outbound HTTP failures from rolling back core database writes

-- 1. Remove redundant HTTP post call from chat message trigger
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

  -- Insert in-app notifications for all channel members except the sender
  -- (This will automatically fire the tr_push_notification_on_insert trigger on notifications table)
  FOR recipient_member IN
    SELECT DISTINCT user_id 
    FROM public.channel_members 
    WHERE channel_id = NEW.channel_id 
      AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
    VALUES (
      recipient_member.user_id,
      sender_name,
      message_preview,
      'chat',
      NEW.channel_id,
      'chat',
      '/chat/' || NEW.channel_id::TEXT,
      FALSE
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply linter search_path security settings
ALTER FUNCTION public.on_new_chat_message() SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION public.on_new_chat_message() TO authenticated, service_role;


-- 2. Wrap push notification HTTP post call in EXCEPTION block to prevent transaction rollbacks
CREATE OR REPLACE FUNCTION public.on_new_notification_inserted()
RETURNS trigger AS $$
DECLARE
  recipient_token RECORD;
BEGIN
  -- Loop through all push tokens belonging to the notified user
  FOR recipient_token IN
    SELECT token FROM public.user_push_tokens WHERE user_id = NEW.user_id
  LOOP
    BEGIN
      -- Post to Expo API with explicit channelId
      PERFORM net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := json_build_object(
          'to', recipient_token.token,
          'title', NEW.title,
          'body', NEW.message,
          'sound', 'default',
          'channelId', 'default',
          'data', json_build_object(
            'id', NEW.id,
            'type', NEW.type,
            'entity_type', NEW.entity_type,
            'entity_id', NEW.entity_id,
            'action_url', NEW.action_url
          )
        )::jsonb,
        timeout_ms := 5000
      );
    EXCEPTION WHEN OTHERS THEN
      -- Catch and log the failure as a warning, allowing the transaction to complete
      RAISE WARNING 'Push notification failed for token %: %', recipient_token.token, SQLERRM;
    END;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply search path security settings
ALTER FUNCTION public.on_new_notification_inserted() SET search_path = public, pg_temp;
GRANT EXECUTE ON FUNCTION public.on_new_notification_inserted() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
