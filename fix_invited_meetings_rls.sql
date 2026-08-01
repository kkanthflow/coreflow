-- Fix for participants not being able to view their invited meetings
-- The original policy on meetings only allowed hosts and workspace members to view meetings.
-- This adds a policy so that any user explicitly invited (in meeting_participants) can also view it.

-- First, ensure the auth_is_meeting_participant function exists (from fix_recursion migration)
CREATE OR REPLACE FUNCTION auth_is_meeting_participant(_meeting_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM meeting_participants 
        WHERE meeting_id = _meeting_id 
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

-- Then add the missing policy on meetings
DROP POLICY IF EXISTS "Participants can view their meetings" ON meetings;
CREATE POLICY "Participants can view their meetings" ON meetings
    FOR SELECT USING (
        auth_is_meeting_participant(id)
    );
