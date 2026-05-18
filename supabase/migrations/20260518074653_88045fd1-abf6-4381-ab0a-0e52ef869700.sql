-- Substitui triggers para deixarem de referenciar colunas que vão cair
DROP TRIGGER IF EXISTS trg_product_deliverable_roadmap_only ON public.product_deliverable_templates;
DROP TRIGGER IF EXISTS trg_project_deliverable_roadmap_only ON public.project_deliverables;
DROP FUNCTION IF EXISTS public.enforce_roadmap_no_recurrence();
DROP FUNCTION IF EXISTS public.enforce_project_deliverable_no_recurrence();

-- Roadmap: força cadência válida (sem mais flags de recorrência)
CREATE OR REPLACE FUNCTION public.enforce_roadmap_cadence_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cadence IS NULL OR NEW.cadence NOT IN ('unica','sem_data') THEN
    NEW.cadence := 'unica';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_deliverable_roadmap_only
BEFORE INSERT OR UPDATE ON public.product_deliverable_templates
FOR EACH ROW EXECUTE FUNCTION public.enforce_roadmap_cadence_only();

-- 1) products: campo morto
ALTER TABLE public.products DROP COLUMN IF EXISTS welcome_email_accent_color;

-- 2) project_phases: recorrência legacy (UI removida)
ALTER TABLE public.project_phases
  DROP COLUMN IF EXISTS is_recurring,
  DROP COLUMN IF EXISTS recurrence_frequency,
  DROP COLUMN IF EXISTS recurrence_anchor_day,
  DROP COLUMN IF EXISTS recurrence_week_of_month,
  DROP COLUMN IF EXISTS recurrence_lead_days;

-- 3) product_deliverable_templates: campos de recorrência (recorrência vive em product_recurring_items)
ALTER TABLE public.product_deliverable_templates
  DROP COLUMN IF EXISTS is_recurring,
  DROP COLUMN IF EXISTS recurrence_frequency,
  DROP COLUMN IF EXISTS recurrence_anchor_day,
  DROP COLUMN IF EXISTS recurrence_week_of_month,
  DROP COLUMN IF EXISTS recurrence_lead_days;

-- 4) project_deliverables: recorrência interna do projeto (substituída por project_recurring_occurrences)
ALTER TABLE public.project_deliverables
  DROP COLUMN IF EXISTS is_recurring,
  DROP COLUMN IF EXISTS recurrence_week,
  DROP COLUMN IF EXISTS recurrence_weekday,
  DROP COLUMN IF EXISTS recurrence_label;