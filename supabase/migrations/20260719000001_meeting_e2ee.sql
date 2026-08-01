-- 20260719000001_meeting_e2ee.sql

CREATE TABLE IF NOT EXISTS meeting_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(meeting_id, user_id)
);

ALTER TABLE meeting_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own meeting keys or for others if they are host" ON meeting_keys;
CREATE POLICY "Users can insert their own meeting keys or for others if they are host" ON meeting_keys
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        auth.uid() IN (SELECT host_id FROM meetings WHERE id = meeting_id) OR
        auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id IN (SELECT workspace_id FROM meetings WHERE id = meeting_id))
    );

DROP POLICY IF EXISTS "Users can read their own keys" ON meeting_keys;
CREATE POLICY "Users can read their own keys" ON meeting_keys
    FOR SELECT USING (auth.uid() = user_id);
