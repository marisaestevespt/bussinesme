
CREATE TABLE IF NOT EXISTS public.department_kpi_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.department_kpis(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  target_value numeric,
  actual_value numeric,
  analysis text,
  auto_analysis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_dkm_kpi_year ON public.department_kpi_monthly (kpi_id, year);

ALTER TABLE public.department_kpi_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dkm"
ON public.department_kpi_monthly FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert dkm"
ON public.department_kpi_monthly FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update dkm"
ON public.department_kpi_monthly FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete dkm"
ON public.department_kpi_monthly FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_dkm_updated_at
BEFORE UPDATE ON public.department_kpi_monthly
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
