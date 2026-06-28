-- 1. Create User Push Tokens Table
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

-- Enable RLS
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can manage their own push tokens"
  ON public.user_push_tokens FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid())::uuid);

-- 2. Enable pg_net extension for HTTP requests if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Trigger Function to Send Push Notifications on New Messages
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

  -- Loop through all other members of the channel
  FOR recipient_token IN
    SELECT t.token, m.user_id
    FROM public.channel_members m
    JOIN public.user_push_tokens t ON t.user_id = m.user_id
    WHERE m.channel_id = NEW.channel_id AND m.user_id != NEW.sender_id
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

-- 4. Create Trigger
DROP TRIGGER IF EXISTS tr_on_new_chat_message ON public.chat_messages;
CREATE TRIGGER tr_on_new_chat_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_new_chat_message();
