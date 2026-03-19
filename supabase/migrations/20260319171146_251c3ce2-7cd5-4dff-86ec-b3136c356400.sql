
-- Add contract-related fields to member_contracts
ALTER TABLE public.member_contracts 
  ADD COLUMN IF NOT EXISTS monthly_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contracted_hours text,
  ADD COLUMN IF NOT EXISTS payment_day integer DEFAULT 1;
