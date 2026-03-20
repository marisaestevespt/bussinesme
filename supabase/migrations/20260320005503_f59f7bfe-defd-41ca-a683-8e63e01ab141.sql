
-- Add measurement_type and objective_type to executive_goals (same as objectives)
ALTER TABLE public.executive_goals
ADD COLUMN IF NOT EXISTS objective_type text NOT NULL DEFAULT 'quantitativo',
ADD COLUMN IF NOT EXISTS measurement_type text NOT NULL DEFAULT 'acumulativo';
