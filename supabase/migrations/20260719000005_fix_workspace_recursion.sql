-- Fix infinite recursion caused by workspace_members policy evaluation
-- The original policy had a subquery on workspace_members itself, causing a loop.

DROP POLICY IF EXISTS "Users can view workspace memberships" ON public.workspace_members;

-- Create a helper function to securely check if a user is in a workspace without triggering RLS loops
CREATE OR REPLACE FUNCTION auth_is_workspace_member(_workspace_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = _workspace_id 
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql;

-- Create the new, safe policy
CREATE POLICY "Users can view workspace memberships"
  ON public.workspace_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    auth_is_workspace_member(workspace_id)
  );
