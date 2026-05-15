
-- 1. Add new columns
ALTER TABLE public.product_deliverable_templates
  ADD COLUMN IF NOT EXISTS cadence text NOT NULL DEFAULT 'unica',
  ADD COLUMN IF NOT EXISTS recurrence_frequency text,
  ADD COLUMN IF NOT EXISTS recurrence_anchor_day integer,
  ADD COLUMN IF NOT EXISTS recurrence_lead_days integer NOT NULL DEFAULT 5;

-- 2. Constraints
ALTER TABLE public.product_deliverable_templates
  DROP CONSTRAINT IF EXISTS product_deliverable_templates_cadence_check;
ALTER TABLE public.product_deliverable_templates
  ADD CONSTRAINT product_deliverable_templates_cadence_check
  CHECK (cadence IN ('unica','por_ciclo_fase','propria','sem_data'));

ALTER TABLE public.product_deliverable_templates
  DROP CONSTRAINT IF EXISTS product_deliverable_templates_recurrence_freq_check;
ALTER TABLE public.product_deliverable_templates
  ADD CONSTRAINT product_deliverable_templates_recurrence_freq_check
  CHECK (recurrence_frequency IS NULL OR recurrence_frequency IN ('semanal','quinzenal','mensal'));

-- 3. Backfill cadence from existing is_recurring
UPDATE public.product_deliverable_templates t
SET cadence = CASE
  WHEN t.is_recurring AND EXISTS (
    SELECT 1 FROM public.product_phases p
    WHERE p.id = t.phase_id AND p.is_recurring = true
  ) THEN 'por_ciclo_fase'
  ELSE 'unica'
END
WHERE cadence = 'unica';

-- 4. Trigger to keep is_recurring in sync with cadence (backwards compat)
CREATE OR REPLACE FUNCTION public.sync_template_is_recurring_from_cadence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_recurring := NEW.cadence IN ('por_ciclo_fase','propria');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_template_is_recurring ON public.product_deliverable_templates;
CREATE TRIGGER trg_sync_template_is_recurring
BEFORE INSERT OR UPDATE OF cadence ON public.product_deliverable_templates
FOR EACH ROW EXECUTE FUNCTION public.sync_template_is_recurring_from_cadence();
