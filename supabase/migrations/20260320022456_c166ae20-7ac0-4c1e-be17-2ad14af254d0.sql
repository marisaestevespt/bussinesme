
-- Planning routines (recurring task templates)
CREATE TABLE public.planning_routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  responsible UUID REFERENCES public.profiles(id),
  recurrence_type TEXT NOT NULL DEFAULT 'semanal',
  weekday INTEGER,
  month_day INTEGER,
  adjust_to_business_day BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.planning_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view planning_routines"
  ON public.planning_routines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert planning_routines"
  ON public.planning_routines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update planning_routines"
  ON public.planning_routines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete planning_routines"
  ON public.planning_routines FOR DELETE TO authenticated USING (true);

-- Add routine tracking columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN routine_id UUID REFERENCES public.planning_routines(id) ON DELETE SET NULL,
  ADD COLUMN tag TEXT;

CREATE INDEX idx_tasks_routine_id ON public.tasks(routine_id);
CREATE INDEX idx_tasks_tag ON public.tasks(tag);
