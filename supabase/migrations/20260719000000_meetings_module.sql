-- 20260719000000_meetings_module.sql
-- Complete schema for CoreFlow Meetings Module

DROP TABLE IF EXISTS meeting_analytics CASCADE;
DROP TABLE IF EXISTS meeting_notes CASCADE;
DROP TABLE IF EXISTS meeting_recordings CASCADE;
DROP TABLE IF EXISTS meeting_events CASCADE;
DROP TABLE IF EXISTS meeting_devices CASCADE;
DROP TABLE IF EXISTS meeting_participants CASCADE;
DROP TABLE IF EXISTS meeting_settings CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;

CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    host_id UUID REFERENCES users(id),
    room_name TEXT UNIQUE NOT NULL, -- e.g., 'cf-meeting-8d72af93' (Source of truth for LiveKit)
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    timezone TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_rule TEXT,
    is_password_protected BOOLEAN DEFAULT false,
    hashed_password TEXT,
    status TEXT DEFAULT 'scheduled', 
    google_event_id TEXT,
    outlook_event_id TEXT,
    ics_uid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting Configuration / Settings
CREATE TABLE meeting_settings (
    meeting_id UUID PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
    waiting_room BOOLEAN DEFAULT true,
    recording_enabled BOOLEAN DEFAULT true,
    allow_chat BOOLEAN DEFAULT true,
    allow_screen_share BOOLEAN DEFAULT true,
    allow_unmute BOOLEAN DEFAULT true,
    allow_camera BOOLEAN DEFAULT true,
    participant_limit INTEGER DEFAULT 100,
    allow_join_before_host BOOLEAN DEFAULT false,
    auto_lock_minutes INTEGER DEFAULT NULL
);

-- Meeting Participants & Temporary Permissions
CREATE TABLE meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    role TEXT DEFAULT 'participant', 
    status TEXT DEFAULT 'invited', 
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    can_share_screen BOOLEAN DEFAULT false,
    can_chat BOOLEAN DEFAULT true,
    can_record BOOLEAN DEFAULT false,
    can_present BOOLEAN DEFAULT false,
    can_invite BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    camera_disabled BOOLEAN DEFAULT false
);

-- Diagnostics & Devices
CREATE TABLE meeting_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID REFERENCES meeting_participants(id) ON DELETE CASCADE,
    device_type TEXT,
    os TEXT,
    browser TEXT,
    network_type TEXT,
    camera_name TEXT,
    microphone_name TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ
);

-- Audit Logs & Playback Timeline
CREATE TABLE meeting_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES meeting_participants(id),
    event_type TEXT NOT NULL, 
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recordings
CREATE TABLE meeting_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    file_url TEXT,
    duration INTEGER,
    resolution TEXT,
    file_size BIGINT,
    recording_status TEXT DEFAULT 'processing',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    storage_provider TEXT DEFAULT 's3'
);

-- Manual Meeting Notes
CREATE TABLE meeting_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Data
CREATE TABLE meeting_analytics (
    meeting_id UUID PRIMARY KEY REFERENCES meetings(id) ON DELETE CASCADE,
    total_participants INTEGER DEFAULT 0,
    peak_participants INTEGER DEFAULT 0,
    average_connection_quality TEXT,
    average_latency INTEGER,
    meeting_duration INTEGER, -- In seconds
    total_chat_messages INTEGER DEFAULT 0,
    screen_share_duration INTEGER DEFAULT 0
);

-- Row Level Security (RLS)

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_analytics ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Users can view meetings in their workspace, or where they are host/participant)
CREATE POLICY "Users can view workspace meetings" ON meetings
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Hosts can insert/update meetings" ON meetings
    FOR ALL USING (host_id = auth.uid());

CREATE POLICY "Users can view participants for their meetings" ON meeting_participants
    FOR SELECT USING (
        meeting_id IN (SELECT id FROM meetings WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
    );

-- Similar read policies for other tables
CREATE POLICY "Users can view meeting settings" ON meeting_settings
    FOR SELECT USING (
        meeting_id IN (SELECT id FROM meetings WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
    );
