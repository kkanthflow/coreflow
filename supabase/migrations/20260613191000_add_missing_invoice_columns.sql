-- Migration: Ensure all enterprise columns exist on public.invoices and reload schema cache
-- Path: d:\projects\coreflow\supabase\migrations\20260613191000_add_missing_invoice_columns.sql

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS cgst NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sgst NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS igst NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS template_style VARCHAR(50) DEFAULT 'classic';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) DEFAULT 'INR';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recurring_frequency VARCHAR(50);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS next_run_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recurring_end_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recurring_active BOOLEAN DEFAULT TRUE;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
