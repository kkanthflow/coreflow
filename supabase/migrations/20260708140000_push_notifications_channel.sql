-- Update on_new_notification_inserted trigger function to send channelId for Android compatibility

CREATE OR REPLACE FUNCTION public.on_new_notification_inserted()
RETURNS trigger AS $$
DECLARE
  recipient_token RECORD;
BEGIN
  -- Loop through all push tokens belonging to the notified user
  FOR recipient_token IN
    SELECT token FROM public.user_push_tokens WHERE user_id = NEW.user_id
  LOOP
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
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.on_new_notification_inserted() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.on_new_notification_inserted() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
