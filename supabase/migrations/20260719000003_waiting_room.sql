-- Migration to add waiting room / admission status support to meeting participants

ALTER TABLE meeting_participants 
ADD COLUMN IF NOT EXISTS admission_status text DEFAULT 'none' NOT NULL;

-- Only 'none', 'waiting', 'admitted', 'rejected' are valid
ALTER TABLE meeting_participants
ADD CONSTRAINT admission_status_check
CHECK (admission_status IN ('none', 'waiting', 'admitted', 'rejected'));
