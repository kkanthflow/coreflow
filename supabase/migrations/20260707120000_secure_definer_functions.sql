-- Migration to address database linter warnings (search_path mutable and public definer executable)

-- 1. Apply Search Path and Revoke Execute for clean_duplicate_push_tokens
ALTER FUNCTION public.clean_duplicate_push_tokens() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.clean_duplicate_push_tokens() FROM PUBLIC, anon, authenticated;

-- 2. Apply Search Path and Revoke Execute for on_new_chat_message
ALTER FUNCTION public.on_new_chat_message() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.on_new_chat_message() FROM PUBLIC, anon, authenticated;

-- 3. Apply Search Path and Revoke Execute for on_new_notification_inserted
ALTER FUNCTION public.on_new_notification_inserted() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.on_new_notification_inserted() FROM PUBLIC, anon, authenticated;

-- 4. Apply Search Path and Revoke Execute for notify_meeting_attendees
ALTER FUNCTION public.notify_meeting_attendees() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.notify_meeting_attendees() FROM PUBLIC, anon, authenticated;

-- 5. Apply Search Path and Revoke Execute for notify_task_updates
ALTER FUNCTION public.notify_task_updates() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.notify_task_updates() FROM PUBLIC, anon, authenticated;

-- 6. Apply Search Path and Revoke Execute for notify_project_updates
ALTER FUNCTION public.notify_project_updates() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.notify_project_updates() FROM PUBLIC, anon, authenticated;

-- 7. Apply Search Path and Revoke Execute for notify_invoice_updates
ALTER FUNCTION public.notify_invoice_updates() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.notify_invoice_updates() FROM PUBLIC, anon, authenticated;
