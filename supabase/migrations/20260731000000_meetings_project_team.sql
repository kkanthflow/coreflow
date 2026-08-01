-- Add project_id and team_id to meetings table

ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.departments(id) ON DELETE SET NULL; -- Assuming 'departments' serves as teams
