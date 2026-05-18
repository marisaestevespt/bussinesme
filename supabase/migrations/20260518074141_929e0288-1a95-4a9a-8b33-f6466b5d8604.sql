-- 1) Garantir que nenhum template de roadmap pode ser recorrente
CREATE OR REPLACE FUNCTION public.enforce_roadmap_no_recurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Forçar não-recorrência no roadmap
  IF NEW.is_recurring = true THEN
    NEW.is_recurring := false;
    NEW.recurrence_frequency := NULL;
    NEW.recurrence_anchor_day := NULL;
    NEW.recurrence_lead_days := NULL;
    NEW.recurrence_week_of_month := NULL;
  END IF;
  -- Forçar cadência válida apenas para roadmap
  IF NEW.cadence IS NULL OR NEW.cadence NOT IN ('unica','sem_data') THEN
    NEW.cadence := 'unica';
  END IF;
  RETURN NEW;
END;
$$;

-- Substitui o trigger antigo (enforce_recurring_no_phase) por este mais restritivo
DROP TRIGGER IF EXISTS trg_product_deliverable_recurring_no_phase ON public.product_deliverable_templates;
DROP TRIGGER IF EXISTS trg_product_deliverable_roadmap_only ON public.product_deliverable_templates;
CREATE TRIGGER trg_product_deliverable_roadmap_only
BEFORE INSERT OR UPDATE ON public.product_deliverable_templates
FOR EACH ROW
EXECUTE FUNCTION public.enforce_roadmap_no_recurrence();

-- 2) Mesmo para project_deliverables (instâncias)
CREATE OR REPLACE FUNCTION public.enforce_project_deliverable_no_recurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_recurring = true THEN
    NEW.is_recurring := false;
    NEW.recurrence_week := NULL;
    NEW.recurrence_weekday := NULL;
    NEW.recurrence_label := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_deliverable_recurring_no_phase ON public.project_deliverables;
DROP TRIGGER IF EXISTS trg_project_deliverable_roadmap_only ON public.project_deliverables;
CREATE TRIGGER trg_project_deliverable_roadmap_only
BEFORE INSERT OR UPDATE ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.enforce_project_deliverable_no_recurrence();

-- 3) Limpar dados existentes que ainda tenham flags inválidas
UPDATE public.product_deliverable_templates
   SET is_recurring = false,
       recurrence_frequency = NULL,
       recurrence_anchor_day = NULL,
       recurrence_lead_days = NULL,
       recurrence_week_of_month = NULL
 WHERE is_recurring = true;

UPDATE public.product_deliverable_templates
   SET cadence = 'unica'
 WHERE cadence IS NULL OR cadence NOT IN ('unica','sem_data');

UPDATE public.project_deliverables
   SET is_recurring = false,
       recurrence_week = NULL,
       recurrence_weekday = NULL,
       recurrence_label = NULL
 WHERE is_recurring = true;