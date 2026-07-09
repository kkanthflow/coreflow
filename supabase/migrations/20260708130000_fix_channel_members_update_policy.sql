-- Add UPDATE policy for channel_members to allow users to update their last_read_at

DROP POLICY IF EXISTS "Users can update own channel membership" ON public.channel_members;

CREATE POLICY "Users can update own channel membership" 
ON public.channel_members 
FOR UPDATE 
TO authenticated 
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

NOTIFY pgrst, 'reload schema';
