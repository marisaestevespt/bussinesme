ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS mission text,
  ADD COLUMN IF NOT EXISTS vision text,
  ADD COLUMN IF NOT EXISTS values_list jsonb NOT NULL DEFAULT '[]'::jsonb;