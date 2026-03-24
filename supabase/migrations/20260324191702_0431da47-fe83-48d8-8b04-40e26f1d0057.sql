ALTER TABLE public.financial_subscriptions ADD COLUMN IF NOT EXISTS nif text DEFAULT '';
ALTER TABLE public.financial_subscriptions ADD COLUMN IF NOT EXISTS country text DEFAULT '';