
-- Absence coverage table
CREATE TABLE public.absence_coverage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT 'ferias',
  substitute_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  sos_notes TEXT,
  status TEXT NOT NULL DEFAULT 'agendada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.absence_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view absence_coverage"
  ON public.absence_coverage FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert absence_coverage"
  ON public.absence_coverage FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update absence_coverage"
  ON public.absence_coverage FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete absence_coverage"
  ON public.absence_coverage FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_absence_coverage_updated_at
  BEFORE UPDATE ON public.absence_coverage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add original_assignee to tasks table
ALTER TABLE public.tasks ADD COLUMN original_assignee UUID REFERENCES public.profiles(id);
