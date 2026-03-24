
ALTER TABLE public.capacity_scenarios
  ADD COLUMN IF NOT EXISTS business_percent numeric NOT NULL DEFAULT 0;
