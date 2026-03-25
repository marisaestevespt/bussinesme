CREATE TABLE public.weekly_align_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  decisions text DEFAULT '',
  blockers text DEFAULT '',
  key_points text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(week_start)
);

ALTER TABLE public.weekly_align_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage weekly notes"
  ON public.weekly_align_notes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_weekly_align_notes_updated_at
  BEFORE UPDATE ON public.weekly_align_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();