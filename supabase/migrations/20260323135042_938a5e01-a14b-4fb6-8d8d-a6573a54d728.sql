-- Add start_date and end_date to commercial_strategy
ALTER TABLE public.commercial_strategy
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

-- Create junction table for strategy <-> projects
CREATE TABLE IF NOT EXISTS public.commercial_strategy_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES public.commercial_strategy(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(strategy_id, project_id)
);

ALTER TABLE public.commercial_strategy_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage strategy projects"
  ON public.commercial_strategy_projects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);