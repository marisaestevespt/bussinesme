
-- 1. Add 'link' to deliverable_type enum
ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'link';

-- 2. Add new columns to project_deliverables
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS document_file_path text;

-- 3. Add new columns to product_deliverable_templates
ALTER TABLE public.product_deliverable_templates
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS document_file_path text;

-- 4. Create storage bucket for deliverable documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('deliverable-documents', 'deliverable-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies — authenticated team members can manage
CREATE POLICY "Authenticated can view deliverable documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deliverable-documents');

CREATE POLICY "Authenticated can upload deliverable documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'deliverable-documents');

CREATE POLICY "Authenticated can update deliverable documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'deliverable-documents');

CREATE POLICY "Authenticated can delete deliverable documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'deliverable-documents');
