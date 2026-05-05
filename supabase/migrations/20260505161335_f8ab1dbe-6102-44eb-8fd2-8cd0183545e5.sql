-- Attachments per section (link or file)
CREATE TABLE IF NOT EXISTS public.brand_kanban_section_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.brand_kanban_sections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('link', 'file')),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  file_path TEXT,
  file_type TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kanban_section_attachments_section
  ON public.brand_kanban_section_attachments(section_id, sort_order);

ALTER TABLE public.brand_kanban_section_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brand kanban section attachments"
  ON public.brand_kanban_section_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand kanban section attachments"
  ON public.brand_kanban_section_attachments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update brand kanban section attachments"
  ON public.brand_kanban_section_attachments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand kanban section attachments"
  ON public.brand_kanban_section_attachments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Storage bucket for section files
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-section-files', 'brand-section-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read brand section files"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'brand-section-files');

CREATE POLICY "Owners can upload brand section files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-section-files' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update brand section files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-section-files' AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete brand section files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand-section-files' AND public.has_role(auth.uid(), 'owner'));