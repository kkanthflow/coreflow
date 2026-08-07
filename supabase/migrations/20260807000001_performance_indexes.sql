-- 20260807000001_performance_indexes.sql
-- Adds necessary b-tree indexes for enterprise scalability to prevent full table scans.

-- 1. Indexes for meeting_invitations
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_meeting_id ON meeting_invitations(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_user_id ON meeting_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_invitations_status ON meeting_invitations(status);

-- 2. Indexes for meeting_participants (if exists, normally the primary key is (meeting_id, user_id) but let's ensure indexes)
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id ON meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_status ON meeting_participants(admission_status);

-- 3. Indexes for meetings
CREATE INDEX IF NOT EXISTS idx_meetings_host_id ON meetings(host_id);
