-- 20260801130000_fix_net_http_post_type.sql

CREATE OR REPLACE FUNCTION public.on_new_notification_inserted()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://coreflow-one.vercel.app/api/notifications/send-push'::text,
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
