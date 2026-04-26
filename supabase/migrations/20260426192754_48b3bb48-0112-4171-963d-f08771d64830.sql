ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS weekly_align_day SMALLINT NOT NULL DEFAULT 5
CHECK (weekly_align_day BETWEEN 1 AND 7);

COMMENT ON COLUMN public.business_settings.weekly_align_day IS 'Dia da semana em que se faz o Weekly Align (1=segunda, 7=domingo). Default 5 (sexta-feira).';