-- Migration to exclude any push tokens associated with the sender from receiving notifications
CREATE OR REPLACE FUNCTION public.on_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_token RECORD;
  sender_name TEXT;
  message_preview TEXT;
  channel_name TEXT;
  notification_title TEXT;
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

  -- Get channel details to determine title
  SELECT name INTO channel_name FROM public.chat_channels WHERE id = NEW.channel_id;

  -- Loop through all other members of the channel, excluding any tokens belonging to the sender
  FOR recipient_token IN
    SELECT DISTINCT t.token, m.user_id
    FROM public.channel_members m
    JOIN public.user_push_tokens t ON t.user_id = m.user_id
    WHERE m.channel_id = NEW.channel_id 
      AND m.user_id != NEW.sender_id
      AND t.token NOT IN (
        SELECT token FROM public.user_push_tokens WHERE user_id = NEW.sender_id
      )
  LOOP
    -- Send push notification via Expo Push API
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object(
        'to', recipient_token.token,
        'title', sender_name,
        'body', message_preview,
        'sound', 'default',
        'data', json_build_object(
          'channelId', NEW.channel_id,
          'senderId', NEW.sender_id
        )
      )::jsonb
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
