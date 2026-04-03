-- Add digest_type column to distinguish morning vs end-of-day digests
ALTER TABLE public.digest_settings 
ADD COLUMN digest_type text NOT NULL DEFAULT 'morning';

-- Add comment for clarity
COMMENT ON COLUMN public.digest_settings.digest_type IS 'morning = briefing da manhã, eod = wrap-up de fim de dia';