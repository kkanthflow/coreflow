-- Fix the default admission status so invited users go to the waiting room by default
CREATE OR REPLACE FUNCTION enforce_meeting_admission_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Always ensure host is admitted and others are waiting when first added to the meeting
  IF NEW.role = 'host' THEN
    NEW.admission_status = 'admitted';
  ELSE
    NEW.admission_status = 'waiting';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_enforce_meeting_admission_status ON public.meeting_participants;
CREATE TRIGGER tr_enforce_meeting_admission_status
BEFORE INSERT ON public.meeting_participants
FOR EACH ROW
EXECUTE FUNCTION enforce_meeting_admission_status();
