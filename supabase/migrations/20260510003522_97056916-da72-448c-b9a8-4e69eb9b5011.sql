-- 1. Products: pricing mode + range + complexity + discounts
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS price_min NUMERIC,
  ADD COLUMN IF NOT EXISTS price_max NUMERIC,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS complexity_levels JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS volume_discounts JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Pricing drivers (variables that feed the formula)
CREATE TABLE IF NOT EXISTS public.product_pricing_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  default_qty NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_drivers_product ON public.product_pricing_drivers(product_id);
ALTER TABLE public.product_pricing_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage pricing drivers"
  ON public.product_pricing_drivers FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "block_suspended_users_drivers"
  ON public.product_pricing_drivers FOR ALL
  USING (NOT current_user_is_suspended());

-- 3. Quotes (snapshot of a calculated price for a lead/client)
CREATE TABLE IF NOT EXISTS public.product_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT,
  pricing_mode TEXT NOT NULL DEFAULT 'fixo',
  -- Variable mode snapshot
  drivers_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_price NUMERIC DEFAULT 0,
  complexity_key TEXT,
  complexity_multiplier NUMERIC DEFAULT 1,
  -- Fixed mode
  selected_tier_id UUID REFERENCES public.product_price_tiers(id) ON DELETE SET NULL,
  -- Common
  discount_pct NUMERIC DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | enviada | aceite | rejeitada | expirada
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX IF NOT EXISTS idx_quotes_product ON public.product_quotes(product_id);
CREATE INDEX IF NOT EXISTS idx_quotes_lead ON public.product_quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client ON public.product_quotes(client_id);
ALTER TABLE public.product_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage product quotes"
  ON public.product_quotes FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "block_suspended_users_quotes"
  ON public.product_quotes FOR ALL
  USING (NOT current_user_is_suspended());

-- 4. Propagation columns
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC,
  ADD COLUMN IF NOT EXISTS current_quote_id UUID REFERENCES public.product_quotes(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget NUMERIC,
  ADD COLUMN IF NOT EXISTS source_quote_id UUID REFERENCES public.product_quotes(id) ON DELETE SET NULL;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.product_quotes(id) ON DELETE SET NULL;

-- 5. Updated_at triggers
DROP TRIGGER IF EXISTS trg_pricing_drivers_updated ON public.product_pricing_drivers;
CREATE TRIGGER trg_pricing_drivers_updated BEFORE UPDATE ON public.product_pricing_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_quotes_updated ON public.product_quotes;
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.product_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();