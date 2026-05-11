
-- 1) executive_objectives: contribui_visao_5_anos + 8-area CHECK + unique(area,year)
ALTER TABLE public.executive_objectives
  ADD COLUMN IF NOT EXISTS contribui_visao_5_anos boolean NOT NULL DEFAULT false;

-- Backfill area legacy values into the 8 official areas
UPDATE public.executive_objectives SET area = 'produtos' WHERE area IN ('produto', 'inovacao');
UPDATE public.executive_objectives SET area = 'operacao' WHERE area = 'processos';
UPDATE public.executive_objectives SET area = 'geral'    WHERE area IN ('outro', NULL) OR area NOT IN ('comercial','marketing','financeiro','operacao','clientes','produtos','equipa','geral');

ALTER TABLE public.executive_objectives
  ADD CONSTRAINT executive_objectives_area_check
  CHECK (area IN ('comercial','marketing','financeiro','operacao','clientes','produtos','equipa','geral'));

-- Default 'geral' going forward
ALTER TABLE public.executive_objectives ALTER COLUMN area SET DEFAULT 'geral';

-- One objective per area per year
CREATE UNIQUE INDEX IF NOT EXISTS executive_objectives_area_year_key
  ON public.executive_objectives(area, year);

-- 2) planning_goals.period_type CHECK including 'semestral'
ALTER TABLE public.planning_goals
  ADD CONSTRAINT planning_goals_period_type_check
  CHECK (period_type IN ('mensal','trimestral','semestral'));

-- 3) monthly_reflection
CREATE TABLE IF NOT EXISTS public.monthly_reflection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  o_que_correu_bem text,
  o_que_nao_correu text,
  decisoes_mes_seguinte text,
  revisto boolean NOT NULL DEFAULT false,
  revisto_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

ALTER TABLE public.monthly_reflection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_reflection owner full access"
  ON public.monthly_reflection
  FOR ALL TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

CREATE TRIGGER update_monthly_reflection_updated_at
  BEFORE UPDATE ON public.monthly_reflection
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) visao_5_anos
CREATE TABLE IF NOT EXISTS public.visao_5_anos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  ano_alvo int NOT NULL,
  onde_quero_estar jsonb DEFAULT '{}'::jsonb,
  condicoes_necessarias text,
  riscos text,
  alinhamento_anual text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ano_alvo)
);

ALTER TABLE public.visao_5_anos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visao_5_anos owner full access"
  ON public.visao_5_anos
  FOR ALL TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

CREATE TRIGGER update_visao_5_anos_updated_at
  BEFORE UPDATE ON public.visao_5_anos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Sync trigger Executive → Marketing/Financial monthly goals
CREATE OR REPLACE FUNCTION public.sync_exec_objective_to_dept_goals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  monthly_target numeric;
  m int;
BEGIN
  IF NEW.target_value IS NULL OR NEW.target_value = 0 THEN
    RETURN NEW;
  END IF;
  monthly_target := NEW.target_value::numeric / 12.0;

  IF NEW.area = 'financeiro' THEN
    FOR m IN 1..12 LOOP
      INSERT INTO public.financial_goals (year, month, revenue_target)
      VALUES (NEW.year, m, monthly_target)
      ON CONFLICT (year, month)
      DO UPDATE SET revenue_target = EXCLUDED.revenue_target, updated_at = now();
    END LOOP;
  ELSIF NEW.area = 'marketing' THEN
    -- Reference target per month, no specific channel (channel_id NULL means "global")
    FOR m IN 1..12 LOOP
      INSERT INTO public.marketing_goals (year, month, channel_id, metric_key, metric_label, target_value, current_value, sort_order)
      SELECT NEW.year, m, NULL, 'executive_target',
             COALESCE(NEW.title, 'Meta executiva'),
             monthly_target, 0, 0
      WHERE NOT EXISTS (
        SELECT 1 FROM public.marketing_goals
        WHERE year = NEW.year AND month = m
          AND channel_id IS NULL AND metric_key = 'executive_target'
      );

      UPDATE public.marketing_goals
        SET target_value = monthly_target,
            metric_label = COALESCE(NEW.title, metric_label),
            updated_at = now()
        WHERE year = NEW.year AND month = m
          AND channel_id IS NULL AND metric_key = 'executive_target';
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_exec_obj_to_dept_goals ON public.executive_objectives;
CREATE TRIGGER sync_exec_obj_to_dept_goals
  AFTER INSERT OR UPDATE OF target_value, area, year, title
  ON public.executive_objectives
  FOR EACH ROW
  WHEN (NEW.area IN ('financeiro','marketing'))
  EXECUTE FUNCTION public.sync_exec_objective_to_dept_goals();
