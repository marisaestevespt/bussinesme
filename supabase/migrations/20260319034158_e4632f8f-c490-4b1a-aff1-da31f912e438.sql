
CREATE TABLE public.commercial_library_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  entry_type text NOT NULL DEFAULT 'outro',
  product text,
  start_date date,
  end_date date,
  result text NOT NULL DEFAULT 'parcialmente',
  summary text,
  what_worked text,
  what_didnt_work text,
  results_numbers text,
  learnings text,
  materials jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_library_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view library entries"
  ON public.commercial_library_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert library entries"
  ON public.commercial_library_entries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update library entries"
  ON public.commercial_library_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Owners can delete library entries"
  ON public.commercial_library_entries FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('commercial-library', 'commercial-library', true);

CREATE POLICY "Authenticated can upload library files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'commercial-library');

CREATE POLICY "Anyone can view library files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'commercial-library');

CREATE POLICY "Owners can delete library files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'commercial-library' AND has_role(auth.uid(), 'owner'::app_role));
