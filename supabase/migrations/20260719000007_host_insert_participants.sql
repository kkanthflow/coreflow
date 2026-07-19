-- Allow hosts to insert participants when scheduling or updating a meeting
DROP POLICY IF EXISTS "Hosts can insert participants" ON meeting_participants;

CREATE POLICY "Hosts can insert participants" ON meeting_participants
    FOR INSERT WITH CHECK (
        -- User can insert participants if they are the host of the meeting
        meeting_id IN (SELECT id FROM meetings WHERE host_id = auth.uid())
    );
