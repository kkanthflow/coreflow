-- Create covering indexes on the remaining unindexed foreign keys
CREATE INDEX IF NOT EXISTS idx_chat_channels_project_id ON public.chat_channels(project_id);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON public.files(project_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON public.message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone_id ON public.tasks(milestone_id);

NOTIFY pgrst, 'reload schema';
