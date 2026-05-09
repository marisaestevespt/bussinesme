
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS routine_id uuid REFERENCES public.planning_routines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_routine_id ON public.meetings(routine_id);
