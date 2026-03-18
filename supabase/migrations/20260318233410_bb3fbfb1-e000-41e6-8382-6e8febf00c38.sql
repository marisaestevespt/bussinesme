-- Add sop_id to routines so each routine can link to a SOP for step-by-step
ALTER TABLE public.routines ADD COLUMN sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL;

-- Create internal_documents table for Biblioteca
CREATE TABLE public.internal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  content text,
  file_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.internal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view internal documents" ON public.internal_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert internal documents" ON public.internal_documents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update internal documents" ON public.internal_documents FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete internal documents" ON public.internal_documents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_internal_documents_updated_at
  BEFORE UPDATE ON public.internal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();