-- Add visual_recreation JSONB column to invoices table to store layout & branding configurations
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS visual_recreation JSONB;

-- Add visual_recreation JSONB column to bill_references table if not already there
ALTER TABLE public.bill_references ADD COLUMN IF NOT EXISTS visual_recreation JSONB;

NOTIFY pgrst, 'reload schema';
