-- Allow hosts to update participants (specifically for admitting/denying from the waiting room)
DROP POLICY IF EXISTS "Hosts can update participants" ON meeting_participants;

CREATE POLICY "Hosts can update participants" ON meeting_participants FOR
UPDATE USING (
    -- User can update if they are the host of the meeting
    meeting_id IN (
        SELECT id
        FROM meetings
        WHERE
            host_id = auth.uid ()
    )
    OR
    -- Or if they are a 'host' role participant
    EXISTS (
        SELECT 1
        FROM meeting_participants mp
        WHERE
            mp.meeting_id = meeting_participants.meeting_id
            AND mp.user_id = auth.uid ()
            AND mp.role = 'host'
    )
);