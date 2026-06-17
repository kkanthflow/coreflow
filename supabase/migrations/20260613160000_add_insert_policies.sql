-- Add missing INSERT policies for notifications and activity_feed

-- Anyone can create a notification (e.g. for meeting invites)
CREATE POLICY "Users can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

-- Users can log their own activity
CREATE POLICY "Users can create activity feed"
  ON activity_feed FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);
