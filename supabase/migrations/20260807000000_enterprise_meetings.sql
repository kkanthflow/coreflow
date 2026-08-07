-- 20260807000000_enterprise_meetings.sql
-- Adds meeting_invitations and lifecycle fields

-- 1. Add fields to meetings table
ALTER TABLE meetings
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration INTEGER,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- 2. Create meeting_invitations table
CREATE TABLE IF NOT EXISTS meeting_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(meeting_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE meeting_invitations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Users can view their own invitations
CREATE POLICY "Users can view their own invitations" ON meeting_invitations
    FOR SELECT USING (user_id = auth.uid());

-- Hosts can view all invitations for their meetings
CREATE POLICY "Hosts can view invitations for their meetings" ON meeting_invitations
    FOR SELECT USING (
        meeting_id IN (SELECT id FROM meetings WHERE host_id = auth.uid())
    );

-- Hosts can manage invitations for their meetings
CREATE POLICY "Hosts can manage invitations" ON meeting_invitations
    FOR ALL USING (
        meeting_id IN (SELECT id FROM meetings WHERE host_id = auth.uid())
    );

-- Users can update their own invitations (e.g., to accept/decline)
CREATE POLICY "Users can update their own invitations" ON meeting_invitations
    FOR UPDATE USING (user_id = auth.uid());

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_meeting_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_meeting_invitations_updated_at
BEFORE UPDATE ON meeting_invitations
FOR EACH ROW
EXECUTE FUNCTION update_meeting_invitations_updated_at();

-- 6. Turn on publication for Realtime
-- So UI can subscribe to updates on meeting_invitations
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_invitations;
