-- 20260719000009_meeting_notes_rls.sql
-- Add RLS policies for personal meeting notes

DROP POLICY IF EXISTS "Users can insert their own meeting notes" ON meeting_notes;
CREATE POLICY "Users can insert their own meeting notes" ON meeting_notes
    FOR INSERT WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own meeting notes" ON meeting_notes;
CREATE POLICY "Users can update their own meeting notes" ON meeting_notes
    FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Users can select their own meeting notes" ON meeting_notes;
CREATE POLICY "Users can select their own meeting notes" ON meeting_notes
    FOR SELECT USING (author_id = auth.uid());
