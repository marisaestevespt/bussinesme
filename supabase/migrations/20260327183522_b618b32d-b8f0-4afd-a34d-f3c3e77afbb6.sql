ALTER TABLE public.business_settings 
  ADD COLUMN IF NOT EXISTS iva_exemption_end_date date,
  ADD COLUMN IF NOT EXISTS ss_exemption_end_date date;