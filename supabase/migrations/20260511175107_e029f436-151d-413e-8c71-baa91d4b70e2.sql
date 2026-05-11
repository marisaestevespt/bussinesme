CREATE TABLE IF NOT EXISTS public.planning_quarter_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  note text,
  status_override text CHECK (status_override IN ('forte','em_curso','atrasado','a_caminho','sem_metas')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, quarter)
);

ALTER TABLE public.planning_quarter_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quarter notes"
  ON public.planning_quarter_notes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert quarter notes"
  ON public.planning_quarter_notes FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update quarter notes"
  ON public.planning_quarter_notes FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated can delete quarter notes"
  ON public.planning_quarter_notes FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_planning_quarter_notes_updated_at
  BEFORE UPDATE ON public.planning_quarter_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();