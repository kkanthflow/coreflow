-- 20260719000010_meeting_admission_status.sql
-- Add admission_status to meeting_participants for waiting room support

ALTER TABLE meeting_participants 
ADD COLUMN IF NOT EXISTS admission_status TEXT DEFAULT 'none';
