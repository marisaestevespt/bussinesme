
-- Add IBAN and address to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS iban text;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS fiscal_address text;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS payment_method text;

-- Add member_id to suppliers for bidirectional link
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;
