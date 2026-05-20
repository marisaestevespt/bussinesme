-- 1) department_kpis
CREATE TABLE public.department_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  value_source TEXT NOT NULL DEFAULT 'manual',
  source_filter JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ
);

CREATE INDEX idx_department_kpis_dept ON public.department_kpis(department) WHERE is_active = true;

ALTER TABLE public.department_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view department_kpis"
  ON public.department_kpis FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Owners and admins can insert department_kpis"
  ON public.department_kpis FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can update department_kpis"
  ON public.department_kpis FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners and admins can delete department_kpis"
  ON public.department_kpis FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_department_kpis_updated_at
  BEFORE UPDATE ON public.department_kpis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Link Key Result (objective_metrics) -> KPI permanente
ALTER TABLE public.objective_metrics
  ADD COLUMN linked_kpi_id UUID REFERENCES public.department_kpis(id) ON DELETE SET NULL;

CREATE INDEX idx_objective_metrics_linked_kpi ON public.objective_metrics(linked_kpi_id) WHERE linked_kpi_id IS NOT NULL;

-- 3) Link planning_goals (período) -> Key Result específico
ALTER TABLE public.planning_goals
  ADD COLUMN metric_id UUID REFERENCES public.objective_metrics(id) ON DELETE CASCADE;

CREATE INDEX idx_planning_goals_metric ON public.planning_goals(metric_id) WHERE metric_id IS NOT NULL;