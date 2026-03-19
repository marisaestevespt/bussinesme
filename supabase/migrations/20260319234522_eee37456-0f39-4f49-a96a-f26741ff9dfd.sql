
-- Table for team member vacations (multiple periods per member)
CREATE TABLE public.team_member_vacations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_member_vacations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vacations"
  ON public.team_member_vacations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert vacations"
  ON public.team_member_vacations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update vacations"
  ON public.team_member_vacations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete vacations"
  ON public.team_member_vacations FOR DELETE TO authenticated USING (true);

-- Add holiday-related columns to team_members
ALTER TABLE public.team_members
  ADD COLUMN works_holidays BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN custom_holidays JSONB DEFAULT '[]';
