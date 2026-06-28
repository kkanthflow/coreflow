-- Create covering indexes on unindexed foreign keys to optimize joins, updates, and cascading deletes
CREATE INDEX IF NOT EXISTS idx_channel_keys_user_id ON public.channel_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_mutes_channel_id ON public.channel_mutes(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_created_by ON public.chat_channels(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_id ON public.chat_messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_departments_head_user_id ON public.departments(head_user_id);
CREATE INDEX IF NOT EXISTS idx_files_parent_file_id ON public.files(parent_file_id);
CREATE INDEX IF NOT EXISTS idx_files_uploader_id ON public.files(uploader_id);
CREATE INDEX IF NOT EXISTS idx_project_members_added_by ON public.project_members(added_by);
CREATE INDEX IF NOT EXISTS idx_project_members_assigned_by ON public.project_members(assigned_by);
CREATE INDEX IF NOT EXISTS idx_project_members_removed_by ON public.project_members(removed_by);
CREATE INDEX IF NOT EXISTS idx_project_milestones_completed_by ON public.project_milestones(completed_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_role_permissions_granted_by ON public.role_permissions(granted_by);
CREATE INDEX IF NOT EXISTS idx_task_activity_user_id ON public.task_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_id ON public.task_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON public.user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_invited_by ON public.user_organizations(invited_by);

NOTIFY pgrst, 'reload schema';
