-- Add business_sector to business_settings
ALTER TABLE public.business_settings
ADD COLUMN IF NOT EXISTS business_sector text NOT NULL DEFAULT 'servicos_digitais';
