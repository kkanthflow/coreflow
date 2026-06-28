-- Add columns to public.chat_messages to support reactions and delivery receipts
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Recreate index for delivery and read tracing
CREATE INDEX IF NOT EXISTS idx_chat_messages_delivered ON public.chat_messages(delivered_at) WHERE delivered_at IS NULL;

NOTIFY pgrst, 'reload schema';
