
-- Monthly reports table
CREATE TABLE public.monthly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  file_path TEXT,
  file_size_bytes INTEGER,
  report_data JSONB,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage monthly reports"
  ON public.monthly_reports
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Storage bucket for reports
INSERT INTO storage.buckets (id, name, public) VALUES ('monthly-reports', 'monthly-reports', false);

CREATE POLICY "Owners can read monthly reports files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'monthly-reports' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Service role can upload monthly reports files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'monthly-reports');
