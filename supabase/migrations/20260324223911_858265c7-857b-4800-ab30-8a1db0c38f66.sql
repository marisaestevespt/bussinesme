CREATE TABLE public.capacity_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Cenário principal',
  useful_hours_per_month NUMERIC NOT NULL DEFAULT 160,
  admin_percent NUMERIC NOT NULL DEFAULT 20,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.capacity_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage capacity_scenarios"
ON public.capacity_scenarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.capacity_scenario_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES public.capacity_scenarios(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  hours_per_client_month NUMERIC NOT NULL DEFAULT 0,
  current_clients INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.capacity_scenario_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage capacity_scenario_products"
ON public.capacity_scenario_products FOR ALL TO authenticated USING (true) WITH CHECK (true);