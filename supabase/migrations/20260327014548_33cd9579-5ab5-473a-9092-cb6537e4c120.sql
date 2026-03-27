CREATE TABLE public.backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path text NOT NULL,
  file_size_bytes bigint DEFAULT 0,
  tables_count integer DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  trigger_type text NOT NULL DEFAULT 'scheduled',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view backups"
  ON public.backups FOR SELECT TO authenticated
  USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;