ALTER TABLE public.business_settings 
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'eni',
  ADD COLUMN IF NOT EXISTS team_type text NOT NULL DEFAULT 'externa',
  ADD COLUMN IF NOT EXISTS has_accountant boolean NOT NULL DEFAULT false;