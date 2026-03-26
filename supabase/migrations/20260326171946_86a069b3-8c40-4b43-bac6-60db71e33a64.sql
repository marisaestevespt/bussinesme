CREATE TABLE public.portal_project_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name text NOT NULL DEFAULT '',
  product_name text,
  start_date text,
  end_date text,
  status text DEFAULT 'concluido',
  timeline_phases jsonb DEFAULT '[]'::jsonb,
  monthly_summaries jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_project_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage portal project history"
  ON public.portal_project_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can read portal project history"
  ON public.portal_project_history
  FOR SELECT
  TO anon
  USING (true);
