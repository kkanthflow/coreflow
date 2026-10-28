-- Step 7: Create Test Data
-- Insert test users with valid system roles
INSERT INTO users (email, full_name, role, status, department) VALUES
('owner@coreflow.com', 'Organization Owner', 'owner', 'active', 'Executive'),
('admin@coreflow.com', 'Administrator', 'administrator', 'active', 'Operations'),
('manager@coreflow.com', 'Manager', 'manager', 'active', 'Technology'),
('lead@coreflow.com', 'Team Lead', 'team_lead', 'active', 'Technology'),
('member@coreflow.com', 'Team Member', 'team_member', 'active', 'Operations');

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
FROM users WHERE email = 'manager@coreflow.com'
LIMIT 1;
