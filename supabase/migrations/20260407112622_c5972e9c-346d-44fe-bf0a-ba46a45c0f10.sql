-- Add timeline/duration rules to product_phases (template)
ALTER TABLE public.product_phases
  ADD COLUMN duration_days integer DEFAULT NULL,
  ADD COLUMN duration_unit text NOT NULL DEFAULT 'dias_uteis',
  ADD COLUMN offset_days integer DEFAULT 0,
  ADD COLUMN offset_trigger text NOT NULL DEFAULT 'inicio_projeto';

-- Add timeline fields to project_phases (instance) — same rule cols + computed dates
ALTER TABLE public.project_phases
  ADD COLUMN duration_days integer DEFAULT NULL,
  ADD COLUMN duration_unit text NOT NULL DEFAULT 'dias_uteis',
  ADD COLUMN offset_days integer DEFAULT 0,
  ADD COLUMN offset_trigger text NOT NULL DEFAULT 'inicio_projeto',
  ADD COLUMN planned_start date DEFAULT NULL,
  ADD COLUMN planned_end date DEFAULT NULL;

COMMENT ON COLUMN public.product_phases.duration_days IS 'How many days this phase lasts';
COMMENT ON COLUMN public.product_phases.duration_unit IS 'dias_uteis or dias_corridos';
COMMENT ON COLUMN public.product_phases.offset_days IS 'Days after the trigger reference';
COMMENT ON COLUMN public.product_phases.offset_trigger IS 'inicio_projeto or fase_anterior';
COMMENT ON COLUMN public.project_phases.planned_start IS 'Calculated start date, editable';
COMMENT ON COLUMN public.project_phases.planned_end IS 'Calculated end date, editable';