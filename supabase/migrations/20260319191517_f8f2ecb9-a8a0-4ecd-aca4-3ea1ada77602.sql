
ALTER TABLE public.objective_metrics
  ADD COLUMN target_value numeric DEFAULT NULL,
  ADD COLUMN target_unit text DEFAULT '',
  ADD COLUMN green_threshold numeric DEFAULT 90,
  ADD COLUMN yellow_threshold numeric DEFAULT 60;

COMMENT ON COLUMN public.objective_metrics.target_value IS 'Target/goal value for this metric';
COMMENT ON COLUMN public.objective_metrics.green_threshold IS 'Percentage of target above which metric is green (on track)';
COMMENT ON COLUMN public.objective_metrics.yellow_threshold IS 'Percentage of target above which metric is yellow (attention)';
