-- Add year column required by the app
ALTER TABLE public.fiscal_deadline_completions
  ADD COLUMN IF NOT EXISTS year integer;

-- Backfill year from deadline_key suffix (e.g. ss-2026-3, iva-pay-q1-2026, iva-decl-m4-2026)
UPDATE public.fiscal_deadline_completions
SET year = (regexp_match(deadline_key, '(\d{4})(?!.*\d{4})'))[1]::int
WHERE year IS NULL
  AND deadline_key ~ '\d{4}';

-- Prevent duplicate completions for the same deadline
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_deadline_completions_key_uniq
  ON public.fiscal_deadline_completions(deadline_key);

-- Speed up year filter
CREATE INDEX IF NOT EXISTS fiscal_deadline_completions_year_idx
  ON public.fiscal_deadline_completions(year);