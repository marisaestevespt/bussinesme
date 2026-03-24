
ALTER TABLE public.capacity_scenarios
  ADD COLUMN IF NOT EXISTS team_size integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS client_facing_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.capacity_scenario_products
  ADD COLUMN IF NOT EXISTS price_per_client numeric NOT NULL DEFAULT 0;
