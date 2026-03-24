CREATE TABLE public.project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  deadline date,
  status text NOT NULL DEFAULT 'pendente',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage deliverables"
  ON public.project_deliverables
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_project_deliverables_updated_at
  BEFORE UPDATE ON public.project_deliverables
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();