-- product_phases: campos de recorrência
ALTER TABLE public.product_phases
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency text,
  ADD COLUMN IF NOT EXISTS recurrence_anchor_day integer,
  ADD COLUMN IF NOT EXISTS recurrence_lead_days integer DEFAULT 5;

-- project_phases: mesmos campos + period tracker
ALTER TABLE public.project_phases
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency text,
  ADD COLUMN IF NOT EXISTS recurrence_anchor_day integer,
  ADD COLUMN IF NOT EXISTS recurrence_lead_days integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS recurrence_period text;

-- Índice para cron evitar duplicação
CREATE UNIQUE INDEX IF NOT EXISTS project_phases_recurrence_period_unique
  ON public.project_phases(project_id, source_phase_id, recurrence_period)
  WHERE recurrence_period IS NOT NULL;

-- Validações: frequency aceite
ALTER TABLE public.product_phases
  DROP CONSTRAINT IF EXISTS product_phases_recurrence_frequency_check;
ALTER TABLE public.product_phases
  ADD CONSTRAINT product_phases_recurrence_frequency_check
  CHECK (recurrence_frequency IS NULL OR recurrence_frequency IN ('semanal','mensal','trimestral'));

ALTER TABLE public.project_phases
  DROP CONSTRAINT IF EXISTS project_phases_recurrence_frequency_check;
ALTER TABLE public.project_phases
  ADD CONSTRAINT project_phases_recurrence_frequency_check
  CHECK (recurrence_frequency IS NULL OR recurrence_frequency IN ('semanal','mensal','trimestral'));