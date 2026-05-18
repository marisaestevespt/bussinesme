
ALTER TABLE public.product_deliverable_templates ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
ALTER TABLE public.project_deliverables ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
UPDATE public.product_deliverable_templates SET is_recurring = (cadence IN ('por_ciclo_fase','propria'));
