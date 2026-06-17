-- Fix infinite recursion in meetings and meeting_attendees policies

-- 1. Drop the existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view meeting attendees" ON meeting_attendees;
DROP POLICY IF EXISTS "Users can view invited meetings" ON meetings;

-- 2. Create a SECURITY DEFINER function to safely check if a user is an attendee
-- This bypasses RLS and prevents the infinite recursion loop
CREATE OR REPLACE FUNCTION public.check_is_attendee(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.meeting_attendees 
    WHERE meeting_id = p_meeting_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the meetings policy using the secure function
CREATE POLICY "Users can view invited meetings"
  ON meetings FOR SELECT
  USING (
    public.check_is_attendee(id, auth.uid()::uuid)
  );

-- 4. Recreate the meeting_attendees policy using the secure function
CREATE POLICY "Users can view meeting attendees"
  ON meeting_attendees FOR SELECT
  USING (
    user_id = auth.uid()::uuid -- Can view own attendance
    OR 
    EXISTS ( -- Can view attendees of meetings they created
      SELECT 1 FROM meetings
      WHERE id = meeting_attendees.meeting_id
      AND creator_id = auth.uid()::uuid
    )
    OR
    public.check_is_attendee(meeting_id, auth.uid()::uuid) -- Can view attendees of meetings they are invited to
  );
