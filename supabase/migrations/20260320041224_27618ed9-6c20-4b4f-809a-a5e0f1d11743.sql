
-- Product KPIs definition table
CREATE TABLE public.product_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kpi_type TEXT NOT NULL DEFAULT 'numerico' CHECK (kpi_type IN ('numerico', 'percentagem', 'monetario')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('automatico', 'manual')),
  auto_source TEXT,
  monthly_goal DECIMAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.product_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_kpis"
  ON public.product_kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_kpis"
  ON public.product_kpis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_kpis"
  ON public.product_kpis FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete product_kpis"
  ON public.product_kpis FOR DELETE TO authenticated USING (true);

-- Product KPI monthly values
CREATE TABLE public.product_kpi_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES public.product_kpis(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  value DECIMAL,
  notes TEXT,
  UNIQUE (kpi_id, month, year)
);

ALTER TABLE public.product_kpi_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_kpi_values"
  ON public.product_kpi_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_kpi_values"
  ON public.product_kpi_values FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_kpi_values"
  ON public.product_kpi_values FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete product_kpi_values"
  ON public.product_kpi_values FOR DELETE TO authenticated USING (true);

-- Product metrics monthly analysis
CREATE TABLE public.product_metrics_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  what_went_well TEXT,
  what_went_wrong TEXT,
  notes TEXT,
  UNIQUE (product_id, month, year)
);

ALTER TABLE public.product_metrics_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_metrics_analysis"
  ON public.product_metrics_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_metrics_analysis"
  ON public.product_metrics_analysis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_metrics_analysis"
  ON public.product_metrics_analysis FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete product_metrics_analysis"
  ON public.product_metrics_analysis FOR DELETE TO authenticated USING (true);
