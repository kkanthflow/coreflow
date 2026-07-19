-- Fix infinite recursion caused by workspace_members policy evaluation
-- We will change the meeting_participants policy to NOT query workspace_members.
-- Instead, users can view participants if they are the host OR if they are a participant themselves.

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view participants for their meetings" ON meeting_participants;

-- Create a helper function to securely check if a user is in a meeting without triggering RLS loops
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

-- Create the new, safe policy
CREATE POLICY "Users can view participants for their meetings" ON meeting_participants
    FOR SELECT USING (
        user_id = auth.uid()
        OR
        auth_is_meeting_participant(meeting_id)
        OR
        meeting_id IN (SELECT id FROM meetings WHERE host_id = auth.uid())
    );
