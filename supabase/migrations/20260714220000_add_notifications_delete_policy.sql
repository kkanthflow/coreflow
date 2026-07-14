-- Add DELETE RLS policy for notifications table to allow users to permanently clear their notifications
DROP POLICY IF EXISTS delete_own_notifications ON public.notifications;
CREATE POLICY delete_own_notifications ON public.notifications 
    FOR DELETE TO authenticated 
    USING (auth.uid() = user_id);
