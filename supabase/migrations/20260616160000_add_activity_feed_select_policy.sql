-- Add missing SELECT policy for activity_feed table
DROP POLICY IF EXISTS "Users can view activity feed" ON public.activity_feed;
CREATE POLICY "Users can view activity feed" ON public.activity_feed FOR SELECT TO authenticated
  USING (true);
