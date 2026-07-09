-- Update trigger function to insert in-app notifications for chat messages

CREATE OR REPLACE FUNCTION public.on_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_member RECORD;
  recipient_token RECORD;
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

  -- 1. Insert in-app notifications for all channel members except the sender
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

  -- 2. Send push notifications to all recipients with registered tokens
  FOR recipient_token IN
    SELECT DISTINCT t.token
    FROM public.channel_members m
    JOIN public.user_push_tokens t ON t.user_id = m.user_id
    WHERE m.channel_id = NEW.channel_id 
      AND m.user_id != NEW.sender_id
      AND t.token NOT IN (
        SELECT token FROM public.user_push_tokens WHERE user_id = NEW.sender_id
      )
  LOOP
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

NOTIFY pgrst, 'reload schema';
