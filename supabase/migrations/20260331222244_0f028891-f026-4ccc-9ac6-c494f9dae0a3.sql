ALTER TABLE public.suppliers 
  ADD COLUMN contract_start_date date,
  ADD COLUMN contract_end_date date,
  ADD COLUMN last_renewal_date date,
  ADD COLUMN renewal_history jsonb DEFAULT '[]'::jsonb;