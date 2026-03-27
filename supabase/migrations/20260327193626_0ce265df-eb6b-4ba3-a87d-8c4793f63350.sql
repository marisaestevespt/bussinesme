ALTER TABLE public.business_setup
  ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS business_email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_website text DEFAULT '';