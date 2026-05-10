
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS target_price NUMERIC;
ALTER TABLE public.product_offer_scenarios ADD COLUMN IF NOT EXISTS price_role TEXT CHECK (price_role IN ('min','sugerido','max'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_scenarios_role_per_product ON public.product_offer_scenarios(product_id, price_role) WHERE price_role IS NOT NULL;
