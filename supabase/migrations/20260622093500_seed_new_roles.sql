-- Migration: Seed New Roles and Permissions to match PBAC Matrix
-- Path: supabase/migrations/20260622093500_seed_new_roles.sql

INSERT INTO public.roles (role_name, permissions) VALUES
('owner', '[
  "manage_organization", "manage_departments", "manage_roles",
  "invite_users", "remove_users",
  "create_projects", "assign_projects", "manage_projects", "view_projects",
  "create_tasks", "assign_tasks", "manage_tasks",
  "upload_files", "download_files",
  "send_messages", "manage_chat",
  "create_invoices", "approve_invoices",
  "view_reports", "export_reports", "view_audit_logs",
  "schedule_meetings", "view_team_directory", "view_invoices",
  "edit_invoices", "delete_invoices", "record_payments",
  "manage_clients", "manage_bill_references", "generate_invoice_pdfs",
  "manage_test_accounts"
]'::jsonb),

('administrator', '[
  "manage_organization", "manage_departments", "manage_roles",
  "invite_users", "remove_users",
  "create_projects", "assign_projects", "manage_projects", "view_projects",
  "create_tasks", "assign_tasks", "manage_tasks",
  "upload_files", "download_files",
  "send_messages", "manage_chat",
  "create_invoices", "approve_invoices",
  "view_reports", "export_reports", "view_audit_logs",
  "schedule_meetings", "view_team_directory", "view_invoices",
  "edit_invoices", "delete_invoices", "record_payments",
  "manage_clients", "manage_bill_references", "generate_invoice_pdfs"
]'::jsonb),

('director', '[
  "manage_departments", "invite_users", "remove_users",
  "create_projects", "assign_projects", "manage_projects", "view_projects",
  "create_tasks", "assign_tasks", "manage_tasks",
  "upload_files", "download_files",
  "send_messages",
  "create_invoices", "approve_invoices",
  "view_reports", "export_reports",
  "schedule_meetings", "view_team_directory", "view_invoices",
  "edit_invoices", "delete_invoices", "record_payments",
  "manage_clients", "manage_bill_references", "generate_invoice_pdfs"
]'::jsonb),

('senior_manager', '[
  "invite_users",
  "create_projects", "assign_projects", "manage_projects", "view_projects",
  "create_tasks", "assign_tasks", "manage_tasks",
  "upload_files", "download_files",
  "send_messages",
  "create_invoices",
  "view_reports",
  "schedule_meetings", "view_team_directory", "view_invoices",
  "edit_invoices", "record_payments", "manage_clients",
  "manage_bill_references", "generate_invoice_pdfs"
]'::jsonb),

('manager', '[
  "invite_users",
  "create_projects", "assign_projects", "manage_projects", "view_projects",
  "create_tasks", "assign_tasks", "manage_tasks",
  "upload_files", "download_files",
  "send_messages",
  "create_invoices",
  "view_reports",
  "schedule_meetings", "view_team_directory", "view_invoices",
  "edit_invoices", "record_payments", "manage_clients",
  "manage_bill_references", "generate_invoice_pdfs"
]'::jsonb),

('team_lead', '[
  "manage_projects", "view_projects",
  "create_tasks", "assign_tasks", "manage_tasks",
  "upload_files", "download_files",
  "send_messages",
  "schedule_meetings", "view_team_directory"
]'::jsonb),

('senior_employee', '[
  "view_projects",
  "create_tasks", "manage_tasks",
  "upload_files", "download_files",
  "send_messages",
  "schedule_meetings", "view_team_directory"
]'::jsonb),

('employee', '[
  "view_projects",
  "create_tasks", "manage_tasks",
  "upload_files", "download_files",
  "send_messages",
  "schedule_meetings", "view_team_directory"
]'::jsonb),

('intern', '[
  "view_projects",
  "manage_tasks",
  "upload_files", "download_files",
  "send_messages",
  "schedule_meetings", "view_team_directory"
]'::jsonb),

('freelancer', '[
  "view_projects",
  "manage_tasks",
  "upload_files", "download_files",
  "schedule_meetings",
  "view_invoices", "create_invoices", "edit_invoices",
  "record_payments", "manage_clients", "manage_bill_references",
  "generate_invoice_pdfs"
]'::jsonb)
ON CONFLICT (role_name) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
