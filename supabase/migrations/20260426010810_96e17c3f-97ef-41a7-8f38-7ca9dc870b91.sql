-- 1) Alargar product_costs com colunas novas
ALTER TABLE public.product_costs
  ADD COLUMN IF NOT EXISTS scenario_id uuid,
  ADD COLUMN IF NOT EXISTS usage_desc text,
  ADD COLUMN IF NOT EXISTS recurrence text CHECK (recurrence IN ('mensal','anual')),
  ADD COLUMN IF NOT EXISTS hours numeric,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS member_id uuid,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- Normalizar cost_type para nova taxonomia (one_off | recorrente | por_venda | horas)
-- Linhas legadas com cost_type vazio/desconhecido ficam como 'one_off'
UPDATE public.product_costs
   SET cost_type = 'one_off'
 WHERE cost_type IS NULL
    OR cost_type NOT IN ('one_off','recorrente','por_venda','horas');

-- Constraint para valores válidos
DO $$ BEGIN
  ALTER TABLE public.product_costs
    ADD CONSTRAINT product_costs_cost_type_check
    CHECK (cost_type IN ('one_off','recorrente','por_venda','horas'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Nova tabela product_offer_scenarios
CREATE TABLE IF NOT EXISTS public.product_offer_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  desired_margin numeric NOT NULL DEFAULT 80,
  tax_regime text NOT NULL DEFAULT 'simplificado'
    CHECK (tax_regime IN ('simplificado','organizada','dependente')),
  tax_rate numeric NOT NULL DEFAULT 25,
  ss_rate numeric NOT NULL DEFAULT 21.4,
  amortization_mode text NOT NULL DEFAULT 'vendas'
    CHECK (amortization_mode IN ('vendas','periodo')),
  estimated_sales int,
  lifetime_months int,
  notes text,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_offer_scenarios_product
  ON public.product_offer_scenarios(product_id);

CREATE INDEX IF NOT EXISTS idx_product_costs_scenario
  ON public.product_costs(scenario_id);

-- FK depois da tabela existir
DO $$ BEGIN
  ALTER TABLE public.product_costs
    ADD CONSTRAINT product_costs_scenario_fkey
    FOREIGN KEY (scenario_id) REFERENCES public.product_offer_scenarios(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_offer_scenarios_updated ON public.product_offer_scenarios;
CREATE TRIGGER trg_offer_scenarios_updated
  BEFORE UPDATE ON public.product_offer_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RLS
ALTER TABLE public.product_offer_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth manage product_offer_scenarios"
  ON public.product_offer_scenarios
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');