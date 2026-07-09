-- Grant EXECUTE permissions on trigger functions to authenticated users

GRANT EXECUTE ON FUNCTION public.on_new_chat_message() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_meeting_attendees() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_meeting_attendee_inserted() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_new_notification_inserted() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
