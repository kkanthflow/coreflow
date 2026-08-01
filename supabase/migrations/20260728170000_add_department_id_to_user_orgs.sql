-- Add department_id to user_organizations
ALTER TABLE public.user_organizations 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_orgs_dept_id ON public.user_organizations(department_id);
