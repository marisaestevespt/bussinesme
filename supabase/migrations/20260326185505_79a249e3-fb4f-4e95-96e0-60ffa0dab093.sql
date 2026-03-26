
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS tax_iva_regime TEXT NOT NULL DEFAULT 'trimestral',
  ADD COLUMN IF NOT EXISTS tax_irs_regime TEXT NOT NULL DEFAULT 'simplificado',
  ADD COLUMN IF NOT EXISTS activity_start_date DATE,
  ADD COLUMN IF NOT EXISTS ss_exempt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS iva_exempt BOOLEAN NOT NULL DEFAULT false;
