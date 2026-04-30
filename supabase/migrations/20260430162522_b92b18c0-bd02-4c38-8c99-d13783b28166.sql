-- 1. Drop dependencias column
ALTER TABLE public.projects DROP COLUMN IF EXISTS dependencias;

-- 2. project_assets table
CREATE TABLE IF NOT EXISTS public.project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('file','link')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  storage_path TEXT,
  category TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_assets_project_page ON public.project_assets(project_id, page_key);

ALTER TABLE public.project_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view project_assets"
ON public.project_assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert project_assets"
ON public.project_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can update project_assets"
ON public.project_assets FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete project_assets"
ON public.project_assets FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_project_assets_updated_at
BEFORE UPDATE ON public.project_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-assets', 'project-assets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read project-assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-assets');

CREATE POLICY "Authenticated can upload project-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-assets');

CREATE POLICY "Authenticated can update project-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-assets');

CREATE POLICY "Authenticated can delete project-assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-assets');