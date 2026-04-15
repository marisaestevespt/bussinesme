ALTER TABLE public.strategy_distribution_cards
ADD COLUMN link_url text,
ADD COLUMN files jsonb DEFAULT '[]'::jsonb;