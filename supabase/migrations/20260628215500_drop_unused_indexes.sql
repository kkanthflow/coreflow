-- Drop older unused indexes to clean up database overhead
DROP INDEX IF EXISTS public.idx_invoices_deleted;
DROP INDEX IF EXISTS public.idx_tasks_milestone_id;
DROP INDEX IF EXISTS public.idx_chat_messages_delivered;
DROP INDEX IF EXISTS public.idx_project_members_project_id;
DROP INDEX IF EXISTS public.idx_project_members_is_active;
DROP INDEX IF EXISTS public.idx_files_project;
DROP INDEX IF EXISTS public.idx_chat_channels_project;
DROP INDEX IF EXISTS public.idx_message_reads_user;
DROP INDEX IF EXISTS public.idx_departments_is_deleted;
DROP INDEX IF EXISTS public.idx_tasks_status;
DROP INDEX IF EXISTS public.idx_tasks_due_date;
DROP INDEX IF EXISTS public.idx_activity_logs_entity;

NOTIFY pgrst, 'reload schema';
