-- Step 7: Create Test Data
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
