-- Migration to clean up duplicate push tokens and prevent self-notifications
CREATE OR REPLACE FUNCTION public.clean_duplicate_push_tokens()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.user_push_tokens
  WHERE token = NEW.token AND user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_clean_duplicate_push_tokens ON public.user_push_tokens;
CREATE TRIGGER tr_clean_duplicate_push_tokens
  BEFORE INSERT OR UPDATE ON public.user_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_duplicate_push_tokens();
