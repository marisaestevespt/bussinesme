ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS auto_calendar_labels jsonb NOT NULL DEFAULT '{"meeting":"Reuniões","sales":"Campanhas vendas","feriado":"Feriados PT"}'::jsonb;