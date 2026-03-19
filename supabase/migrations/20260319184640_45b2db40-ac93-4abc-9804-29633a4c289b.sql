
-- Add new columns to executive_objectives
ALTER TABLE public.executive_objectives 
  ADD COLUMN IF NOT EXISTS objective_type text NOT NULL DEFAULT 'quantitativo',
  ADD COLUMN IF NOT EXISTS target_value numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_unit text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_value numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS value_source text DEFAULT 'manual';

-- Update area options and status options for objectives
-- (handled in code, no schema change needed)

-- Objective success criteria (for qualitative objectives)
CREATE TABLE public.objective_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.executive_objectives(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.objective_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage objective_criteria" ON public.objective_criteria FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Planning goals (new structure for Metas tab)
CREATE TABLE public.planning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.executive_objectives(id) ON DELETE CASCADE,
  period text NOT NULL,
  period_type text NOT NULL DEFAULT 'mensal',
  target_value text DEFAULT NULL,
  actual_value text DEFAULT NULL,
  deviation text DEFAULT NULL,
  status text NOT NULL DEFAULT 'por_iniciar',
  deviation_decision text DEFAULT NULL,
  year integer NOT NULL DEFAULT EXTRACT(year FROM now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.planning_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage planning_goals" ON public.planning_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Objective metrics
CREATE TABLE public.objective_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.executive_objectives(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  cadence text NOT NULL DEFAULT 'mensal',
  source text NOT NULL DEFAULT 'manual',
  current_value numeric DEFAULT NULL,
  last_updated_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.objective_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage objective_metrics" ON public.objective_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Metric history
CREATE TABLE public.metric_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id uuid NOT NULL REFERENCES public.objective_metrics(id) ON DELETE CASCADE,
  value numeric NOT NULL DEFAULT 0,
  notes text DEFAULT NULL,
  recorded_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.metric_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage metric_history" ON public.metric_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Objective actions
CREATE TABLE public.objective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.executive_objectives(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  action_type text NOT NULL DEFAULT 'simples',
  status text NOT NULL DEFAULT 'por_fazer',
  deadline text DEFAULT NULL,
  responsible_id uuid DEFAULT NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.objective_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage objective_actions" ON public.objective_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add update triggers
CREATE TRIGGER update_planning_goals_updated_at BEFORE UPDATE ON public.planning_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_objective_actions_updated_at BEFORE UPDATE ON public.objective_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
