
-- Add measurement_type to executive_objectives
ALTER TABLE public.executive_objectives
ADD COLUMN measurement_type text NOT NULL DEFAULT 'acumulativo';

-- Add measurement_type to objective_metrics
ALTER TABLE public.objective_metrics
ADD COLUMN measurement_type text NOT NULL DEFAULT 'acumulativo';
