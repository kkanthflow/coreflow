# CoreFlow - Supabase Setup Guide

This guide provides complete instructions for setting up CoreFlow's Supabase backend, including database schema, Row-Level Security (RLS) policies, and JWT authentication configuration.

## Prerequisites

- Supabase account (https://supabase.com)
- Supabase project created
- Supabase URL and anon key obtained

## Step 1: Create Database Tables

Execute the following SQL in your Supabase SQL Editor to create all required tables:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for user roles
CREATE TYPE user_role AS ENUM (
  'managing_director',
  'ceo',
  'cto',
  'project_manager',
  'hr',
  'developer',
  'general_member'
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role user_role DEFAULT 'general_member',
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended
  avatar_url TEXT,
  phone VARCHAR(20),
  department VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- JWT tokens table (for token management and revocation)
CREATE TABLE jwt_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jwt_tokens_user_id ON jwt_tokens(user_id);
CREATE INDEX idx_jwt_tokens_expires_at ON jwt_tokens(expires_at);

-- Meetings table
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  meeting_link VARCHAR(500),
  meeting_link_type VARCHAR(50), -- 'teams', 'google_meet', 'zoom', 'custom'
  location VARCHAR(255),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(50), -- 'daily', 'weekly', 'monthly'
  recurrence_end_date DATE,
  parent_meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  is_cancelled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meetings_creator_id ON meetings(creator_id);
CREATE INDEX idx_meetings_start_time ON meetings(start_time);
CREATE INDEX idx_meetings_is_cancelled ON meetings(is_cancelled);

-- Meeting attendees table
CREATE TABLE meeting_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rsvp_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'tentative'
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_meeting_attendees_meeting_id ON meeting_attendees(meeting_id);
CREATE INDEX idx_meeting_attendees_user_id ON meeting_attendees(user_id);
CREATE INDEX idx_meeting_attendees_rsvp_status ON meeting_attendees(rsvp_status);

-- Role change audit log
CREATE TABLE role_change_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  changed_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_role user_role,
  new_role user_role NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_role_change_audit_user_id ON role_change_audit(user_id);
CREATE INDEX idx_role_change_audit_changed_by_id ON role_change_audit(changed_by_id);
CREATE INDEX idx_role_change_audit_created_at ON role_change_audit(created_at);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50), -- 'meeting_invite', 'meeting_reminder', 'role_change', 'system'
  related_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Activity feed table
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL, -- 'meeting_created', 'meeting_updated', 'user_joined', 'role_changed'
  action_description TEXT NOT NULL,
  related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  related_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at);

-- Test accounts table (for QA testing - can be bulk deleted)
CREATE TABLE test_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  test_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_test_accounts_user_id ON test_accounts(user_id);
```

## Step 2: Enable Row-Level Security (RLS)

Execute the following SQL to enable RLS on all tables:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jwt_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_change_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_accounts ENABLE ROW LEVEL SECURITY;
```

## Step 3: Create RLS Policies

Execute the following SQL to create Row-Level Security policies:

```sql
-- ===== USERS TABLE POLICIES =====

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid()::text = id::text);

-- Users can view all other users (for directory)
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  USING (TRUE);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Only admins (MD, CEO, CTO) can change roles
CREATE POLICY "Only admins can change user roles"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::uuid
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::uuid
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

-- Admins can soft-delete users
CREATE POLICY "Admins can soft-delete users"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::uuid
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::uuid
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

-- ===== JWT TOKENS TABLE POLICIES =====

-- Users can view their own tokens
CREATE POLICY "Users can view own tokens"
  ON jwt_tokens FOR SELECT
  USING (user_id = auth.uid()::uuid);

-- Users can revoke their own tokens
CREATE POLICY "Users can revoke own tokens"
  ON jwt_tokens FOR UPDATE
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- ===== MEETINGS TABLE POLICIES =====

-- Users can view meetings they created
CREATE POLICY "Users can view own meetings"
  ON meetings FOR SELECT
  USING (creator_id = auth.uid()::uuid);

-- Users can view meetings they are invited to
CREATE POLICY "Users can view invited meetings"
  ON meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meeting_attendees
      WHERE meeting_id = meetings.id
      AND user_id = auth.uid()::uuid
    )
  );

-- Users can create meetings
CREATE POLICY "Users can create meetings"
  ON meetings FOR INSERT
  WITH CHECK (creator_id = auth.uid()::uuid);

-- Users can update their own meetings
CREATE POLICY "Users can update own meetings"
  ON meetings FOR UPDATE
  USING (creator_id = auth.uid()::uuid)
  WITH CHECK (creator_id = auth.uid()::uuid);

-- Users can delete their own meetings
CREATE POLICY "Users can delete own meetings"
  ON meetings FOR DELETE
  USING (creator_id = auth.uid()::uuid);

-- ===== MEETING ATTENDEES TABLE POLICIES =====

-- Users can view attendees of meetings they're part of
CREATE POLICY "Users can view meeting attendees"
  ON meeting_attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE id = meeting_attendees.meeting_id
      AND (
        creator_id = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM meeting_attendees ma
          WHERE ma.meeting_id = meetings.id
          AND ma.user_id = auth.uid()::uuid
        )
      )
    )
  );

-- Meeting creators can add attendees
CREATE POLICY "Meeting creators can add attendees"
  ON meeting_attendees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = auth.uid()::uuid
    )
  );

-- Users can update their own RSVP status
CREATE POLICY "Users can update own RSVP"
  ON meeting_attendees FOR UPDATE
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- Meeting creators can remove attendees
CREATE POLICY "Meeting creators can remove attendees"
  ON meeting_attendees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = auth.uid()::uuid
    )
  );

-- ===== ROLE CHANGE AUDIT TABLE POLICIES =====

-- Only admins can view role change audit
CREATE POLICY "Only admins can view role audit"
  ON role_change_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::uuid
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

-- Only admins can insert role changes
CREATE POLICY "Only admins can create role audit"
  ON role_change_audit FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::uuid
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

-- ===== NOTIFICATIONS TABLE POLICIES =====

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid()::uuid);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid()::uuid)
  WITH CHECK (user_id = auth.uid()::uuid);

-- ===== ACTIVITY FEED TABLE POLICIES =====

-- Users can view activity feed
CREATE POLICY "Users can view activity feed"
  ON activity_feed FOR SELECT
  USING (TRUE);

-- ===== TEST ACCOUNTS TABLE POLICIES =====

-- Only admins can manage test accounts
CREATE POLICY "Only admins can view test accounts"
  ON test_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::uuid
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );

CREATE POLICY "Only admins can delete test accounts"
  ON test_accounts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::uuid
      AND role IN ('managing_director', 'ceo', 'cto')
    )
  );
```

## Step 4: Create Functions for Common Operations

Execute the following SQL to create helper functions:

```sql
-- Function to create a new user with role
CREATE OR REPLACE FUNCTION create_user_with_role(
  p_email VARCHAR,
  p_full_name VARCHAR,
  p_role user_role DEFAULT 'general_member'
)
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  full_name VARCHAR,
  role user_role
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO users (email, full_name, role)
  VALUES (p_email, p_full_name, p_role)
  RETURNING users.id, users.email, users.full_name, users.role;
END;
$$ LANGUAGE plpgsql;

-- Function to change user role (only for admins)
CREATE OR REPLACE FUNCTION change_user_role(
  p_user_id UUID,
  p_new_role user_role,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_old_role user_role;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid()::uuid;
  
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = v_current_user_id
    AND role IN ('managing_director', 'ceo', 'cto')
  ) THEN
    RETURN QUERY SELECT FALSE, 'Only admins can change roles'::TEXT;
    RETURN;
  END IF;
  
  -- Get old role
  SELECT role INTO v_old_role FROM users WHERE id = p_user_id;
  
  -- Update role
  UPDATE users SET role = p_new_role WHERE id = p_user_id;
  
  -- Log the change
  INSERT INTO role_change_audit (user_id, changed_by_id, old_role, new_role, reason)
  VALUES (p_user_id, v_current_user_id, v_old_role, p_new_role, p_reason);
  
  RETURN QUERY SELECT TRUE, 'Role updated successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to soft-delete a user
CREATE OR REPLACE FUNCTION soft_delete_user(p_user_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  UPDATE users SET is_deleted = TRUE WHERE id = p_user_id;
  RETURN QUERY SELECT TRUE, 'User soft-deleted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up test accounts
CREATE OR REPLACE FUNCTION cleanup_test_accounts()
RETURNS TABLE (
  deleted_count INTEGER,
  message TEXT
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Get count of test accounts
  SELECT COUNT(*) INTO v_count FROM test_accounts;
  
  -- Delete test account users
  DELETE FROM users
  WHERE id IN (SELECT user_id FROM test_accounts);
  
  RETURN QUERY SELECT v_count, 'Test accounts cleaned up'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to get upcoming meetings for a user
CREATE OR REPLACE FUNCTION get_user_upcoming_meetings(p_user_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  creator_id UUID,
  meeting_link VARCHAR,
  meeting_link_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.title, m.start_time, m.end_time, m.creator_id, m.meeting_link, m.meeting_link_type
  FROM meetings m
  WHERE (m.creator_id = p_user_id OR EXISTS (
    SELECT 1 FROM meeting_attendees
    WHERE meeting_id = m.id AND user_id = p_user_id
  ))
  AND m.start_time > NOW()
  AND m.is_cancelled = FALSE
  ORDER BY m.start_time ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

## Step 5: JWT Configuration

### Environment Variables

Add these to your `.env.local` file:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
JWT_EXPIRY_HOURS=24
JWT_REFRESH_EXPIRY_DAYS=7
```

### JWT Token Structure

The JWT token should contain:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "project_manager",
  "iat": 1234567890,
  "exp": 1234571490,
  "aud": "authenticated"
}
```

## Step 6: Verify Setup

Run the following queries to verify your setup:

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check policies exist
SELECT schemaname, tablename, policyname FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;
```

## Step 7: Create Test Data

Execute the following SQL to create test data:

```sql
-- Insert test users with different roles
INSERT INTO users (email, full_name, role, status, department) VALUES
('md@coreflow.com', 'Managing Director', 'managing_director', 'active', 'Executive'),
('ceo@coreflow.com', 'Chief Executive Officer', 'ceo', 'active', 'Executive'),
('cto@coreflow.com', 'Chief Technology Officer', 'cto', 'active', 'Technology'),
('pm@coreflow.com', 'Project Manager', 'project_manager', 'active', 'Operations'),
('hr@coreflow.com', 'HR Manager', 'hr', 'active', 'Human Resources'),
('dev@coreflow.com', 'Developer', 'developer', 'active', 'Technology'),
('member@coreflow.com', 'General Member', 'general_member', 'active', 'Operations');

-- Create a test meeting
INSERT INTO meetings (title, description, creator_id, start_time, end_time, duration_minutes, meeting_link, meeting_link_type)
SELECT 
  'Team Standup',
  'Daily team synchronization meeting',
  id,
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '1 day 1 hour',
  60,
  'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123',
  'teams'
FROM users WHERE email = 'pm@coreflow.com'
LIMIT 1;
```

## Security Best Practices

1. **Always use HTTPS** for all API calls
2. **Store JWT tokens securely** in device keychain/keystore
3. **Implement token refresh** before expiry
4. **Validate JWT tokens** on every request
5. **Use RLS policies** to enforce access control at database level
6. **Implement rate limiting** on authentication endpoints
7. **Log all admin actions** in audit tables
8. **Regularly rotate JWT secrets**
9. **Monitor for suspicious activity** in audit logs
10. **Test RLS policies** thoroughly before production

## Troubleshooting

### Issue: RLS Policy Not Working

- Verify RLS is enabled: `SELECT * FROM pg_tables WHERE tablename = 'users';`
- Check policy syntax: `SELECT * FROM pg_policies WHERE tablename = 'users';`
- Ensure auth.uid() is available (requires Supabase auth)

### Issue: JWT Token Validation Fails

- Verify JWT_SECRET matches Supabase JWT secret
- Check token expiry time
- Ensure token structure matches expected format

### Issue: Role-Based Access Denied

- Verify user role in database
- Check RLS policy for role condition
- Ensure auth.uid() matches user ID

## Next Steps

1. Update your app's environment variables with Supabase credentials
2. Implement JWT token generation and storage in your app
3. Create authentication screens with login/registration
4. Implement role-based dashboard views
5. Build meeting scheduling features
6. Test all RLS policies thoroughly
