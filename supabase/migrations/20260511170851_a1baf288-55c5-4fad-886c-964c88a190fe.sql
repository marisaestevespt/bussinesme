-- ============================================================
-- Planning system cleanup: period normalization, owner_id,
-- notes, sync triggers, drop executive_goals
-- ============================================================

-- ─── 1. Normalize planning_goals.period ───
-- T1..T4 → Q1..Q4
UPDATE public.planning_goals
SET period = REPLACE(period, 'T', 'Q'),
    period_type = 'trimestral'
WHERE period ~ '^T[1-4]$';

-- Month names → YYYY-MM (using row.year)
UPDATE public.planning_goals
SET period = year::text || '-' || LPAD(
    (CASE period
      WHEN 'Janeiro' THEN 1 WHEN 'Fevereiro' THEN 2 WHEN 'Março' THEN 3
      WHEN 'Abril' THEN 4 WHEN 'Maio' THEN 5 WHEN 'Junho' THEN 6
      WHEN 'Julho' THEN 7 WHEN 'Agosto' THEN 8 WHEN 'Setembro' THEN 9
      WHEN 'Outubro' THEN 10 WHEN 'Novembro' THEN 11 WHEN 'Dezembro' THEN 12
    END)::text, 2, '0'),
    period_type = 'mensal'
WHERE period IN ('Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro');

-- ─── 2. Add notes column to planning_goals ───
ALTER TABLE public.planning_goals
  ADD COLUMN IF NOT EXISTS notes text;

-- ─── 3. Add owner_id to executive_objectives ───
ALTER TABLE public.executive_objectives
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_executive_objectives_owner
  ON public.executive_objectives(owner_id);

-- ─── 4. Sync triggers: planning_goals → financial_goals / marketing_goals ───
CREATE OR REPLACE FUNCTION public.sync_planning_to_departmental()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_area text;
  v_month int;
  v_target numeric;
BEGIN
  -- Avoid recursion if departmental tables ever trigger back
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Resolve parent objective area
  SELECT area INTO v_area
  FROM public.executive_objectives
  WHERE id = NEW.objective_id;

  IF v_area IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only act on monthly periods (YYYY-MM)
  IF NEW.period !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN NEW;
  END IF;

  v_month := SUBSTRING(NEW.period FROM 6 FOR 2)::int;
  v_target := NULLIF(NEW.target_value, '')::numeric;

  IF v_target IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_area = 'financeiro' THEN
    INSERT INTO public.financial_goals (year, month, revenue_target)
    VALUES (NEW.year, v_month, v_target)
    ON CONFLICT (year, month) DO UPDATE SET revenue_target = EXCLUDED.revenue_target, updated_at = now();
  ELSIF v_area = 'marketing' THEN
    INSERT INTO public.marketing_goals (year, month, metric_key, metric_label, target_value, current_value, sort_order)
    VALUES (NEW.year, v_month, 'planning_meta_principal', 'Meta Planeamento', v_target, 0, 0)
    ON CONFLICT DO NOTHING;
    UPDATE public.marketing_goals
       SET target_value = v_target, updated_at = now()
     WHERE year = NEW.year AND month = v_month AND metric_key = 'planning_meta_principal';
  END IF;

  RETURN NEW;
END;
$$;

-- financial_goals needs unique (year, month) for the upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'financial_goals_year_month_key'
  ) THEN
    ALTER TABLE public.financial_goals
      ADD CONSTRAINT financial_goals_year_month_key UNIQUE (year, month);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_planning_to_departmental ON public.planning_goals;
CREATE TRIGGER trg_sync_planning_to_departmental
AFTER INSERT OR UPDATE ON public.planning_goals
FOR EACH ROW EXECUTE FUNCTION public.sync_planning_to_departmental();

-- ─── 5. Drop legacy executive_goals (no active code uses it after this migration) ───
DROP TABLE IF EXISTS public.executive_goals CASCADE;