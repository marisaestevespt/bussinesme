ALTER TABLE public.product_offer_scenarios
  ADD COLUMN IF NOT EXISTS last_test_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS price_breakdown JSONB NULL;