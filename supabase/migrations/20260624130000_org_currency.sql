-- Alter organizations table to add default_currency
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS default_currency VARCHAR(10) DEFAULT 'USD';

-- Alter invoice_payments table to add currency
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';

-- Update existing invoice_payments to match their parent invoice's currency, or fall back to USD
UPDATE public.invoice_payments ip
SET currency = COALESCE(i.currency, 'USD')
FROM public.invoices i
WHERE ip.invoice_id = i.id;

-- Make sure existing invoices inherit the organization's default currency if NULL (or default to USD)
UPDATE public.invoices i
SET currency = COALESCE(o.default_currency, 'USD')
FROM public.organizations o
WHERE i.organization_id = o.id AND i.currency IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
