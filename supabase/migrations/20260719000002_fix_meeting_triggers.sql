-- Fix notify_meeting_attendee_inserted
CREATE OR REPLACE FUNCTION public.notify_meeting_attendee_inserted()
RETURNS trigger AS $$
DECLARE
  meeting_title TEXT;
  meeting_host_id UUID;
BEGIN
  -- Fetch meeting details
  SELECT title, host_id INTO meeting_title, meeting_host_id
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  -- Notify the attendee (unless they are the host of the meeting)
  IF NEW.user_id != meeting_host_id THEN
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

-- Re-bind trigger to meeting_participants
DROP TRIGGER IF EXISTS tr_notify_meeting_attendee_inserted ON public.meeting_attendees;
DROP TRIGGER IF EXISTS tr_notify_meeting_participant_inserted ON public.meeting_participants;
CREATE TRIGGER tr_notify_meeting_participant_inserted
  AFTER INSERT ON public.meeting_participants
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_meeting_attendee_inserted();


-- Fix notify_meeting_attendees
CREATE OR REPLACE FUNCTION public.notify_meeting_attendees()
RETURNS trigger AS $$
DECLARE
  attendee RECORD;
  action_msg TEXT;
  notif_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_msg := 'New meeting scheduled: ' || NEW.title;
    notif_type := 'meeting_created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
      action_msg := 'Meeting cancelled: ' || NEW.title;
      notif_type := 'meeting_cancelled';
    ELSIF NEW.title != OLD.title OR NEW.start_time != OLD.start_time THEN
      action_msg := 'Meeting updated: ' || NEW.title;
      notif_type := 'meeting_updated';
    ELSE
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  FOR attendee IN
    SELECT user_id FROM public.meeting_participants WHERE meeting_id = COALESCE(NEW.id, OLD.id)
  LOOP
    IF attendee.user_id != COALESCE(NEW.host_id, OLD.host_id) THEN
      BEGIN
        INSERT INTO public.notifications (user_id, title, message, type, entity_id, entity_type, action_url, is_read)
        VALUES (
          attendee.user_id,
          'Meeting Update',
          action_msg,
          notif_type,
          COALESCE(NEW.id, OLD.id),
          'meeting',
          '/meetings/' || COALESCE(NEW.id, OLD.id)::TEXT,
          FALSE
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[notify_meeting_attendees] Failed to insert notification: %', SQLERRM;
      END;
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.notify_meeting_attendees() SET search_path = public, pg_temp;

-- Re-register meeting trigger
DROP TRIGGER IF EXISTS tr_notify_meeting_attendees ON public.meetings;
CREATE TRIGGER tr_notify_meeting_attendees
  AFTER UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_meeting_attendees();

NOTIFY pgrst, 'reload schema';
