
-- C. Link KPRs to objectives
ALTER TABLE public.department_kpis
  ADD COLUMN IF NOT EXISTS objective_id uuid NULL REFERENCES public.executive_objectives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_department_kpis_objective_id
  ON public.department_kpis(objective_id) WHERE objective_id IS NOT NULL;

-- D. Multi-cadence targets
ALTER TABLE public.department_kpis
  ADD COLUMN IF NOT EXISTS quarterly_target numeric NULL,
  ADD COLUMN IF NOT EXISTS annual_target numeric NULL;

-- Per-quarter overrides + actuals
CREATE TABLE IF NOT EXISTS public.department_kpi_quarterly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.department_kpis(id) ON DELETE CASCADE,
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  target_value numeric NULL,
  actual_value numeric NULL,
  analysis text NULL,
  auto_analysis text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_dkq_kpi_year ON public.department_kpi_quarterly(kpi_id, year);

ALTER TABLE public.department_kpi_quarterly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dkq" ON public.department_kpi_quarterly
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert dkq" ON public.department_kpi_quarterly
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update dkq" ON public.department_kpi_quarterly
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete dkq" ON public.department_kpi_quarterly
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_dkq_updated_at BEFORE UPDATE ON public.department_kpi_quarterly
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync trigger: KPR monthly -> planning_goals (when KPR linked to objective)
CREATE OR REPLACE FUNCTION public.sync_kpr_monthly_to_planning_goal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_objective_id uuid;
  v_period text;
BEGIN
  -- Anti-loop guard
  IF current_setting('app.kpr_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT objective_id INTO v_objective_id
  FROM public.department_kpis WHERE id = NEW.kpi_id;

  IF v_objective_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_period := NEW.year::text || '-' || lpad(NEW.month::text, 2, '0');

  PERFORM set_config('app.kpr_sync', 'on', true);

  INSERT INTO public.planning_goals (objective_id, period, period_type, year, target_value, actual_value, status)
  VALUES (
    v_objective_id, v_period, 'mensal', NEW.year,
    COALESCE(NEW.target_value::text, NULL),
    COALESCE(NEW.actual_value::text, NULL),
    'em_curso'
  )
  ON CONFLICT (objective_id, period, period_type) DO UPDATE
  SET target_value = COALESCE(EXCLUDED.target_value, planning_goals.target_value),
      actual_value = COALESCE(EXCLUDED.actual_value, planning_goals.actual_value),
      updated_at = now();

  PERFORM set_config('app.kpr_sync', 'off', true);

  RETURN NEW;
END;
$$;

-- planning_goals may not have a unique (objective_id, period, period_type) constraint; add it idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'planning_goals_objective_period_type_key'
  ) THEN
    -- Only add if no duplicates exist
    IF NOT EXISTS (
      SELECT 1 FROM (
        SELECT objective_id, period, period_type, count(*) c
        FROM public.planning_goals
        GROUP BY 1,2,3 HAVING count(*) > 1
      ) d
    ) THEN
      ALTER TABLE public.planning_goals
        ADD CONSTRAINT planning_goals_objective_period_type_key UNIQUE (objective_id, period, period_type);
    END IF;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_kpr_to_planning ON public.department_kpi_monthly;
CREATE TRIGGER trg_sync_kpr_to_planning
  AFTER INSERT OR UPDATE ON public.department_kpi_monthly
  FOR EACH ROW EXECUTE FUNCTION public.sync_kpr_monthly_to_planning_goal();
