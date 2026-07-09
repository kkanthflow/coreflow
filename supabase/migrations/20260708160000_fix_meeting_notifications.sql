-- Restructure meeting notifications to notify users when they are added as attendees

-- 1. Create a trigger function on meeting_attendees
CREATE OR REPLACE FUNCTION public.notify_meeting_attendee_inserted()
RETURNS trigger AS $$
DECLARE
  meeting_title TEXT;
  meeting_creator_id UUID;
BEGIN
  -- Fetch meeting details
  SELECT title, creator_id INTO meeting_title, meeting_creator_id
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  -- Notify the attendee (unless they are the creator of the meeting)
  IF NEW.user_id != meeting_creator_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
    VALUES (
      NEW.user_id,
      'Meeting Invitation',
      'You have been invited to a meeting: ' || meeting_title,
      'meeting_created',
      NEW.meeting_id,
      'meeting',
      '/meetings/' || NEW.meeting_id::TEXT,
      FALSE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply linter security parameters for new function
ALTER FUNCTION public.notify_meeting_attendee_inserted() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.notify_meeting_attendee_inserted() FROM PUBLIC, anon, authenticated;

-- Bind the trigger to meeting_attendees
DROP TRIGGER IF EXISTS tr_notify_meeting_attendee_inserted ON public.meeting_attendees;
CREATE TRIGGER tr_notify_meeting_attendee_inserted
  AFTER INSERT ON public.meeting_attendees
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_meeting_attendee_inserted();


-- 2. Modify existing meetings trigger to only fire on UPDATE (since attendees are already mapped)
DROP TRIGGER IF EXISTS tr_notify_meeting_attendees ON public.meetings;
CREATE TRIGGER tr_notify_meeting_attendees
  AFTER UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_meeting_attendees();

NOTIFY pgrst, 'reload schema';
