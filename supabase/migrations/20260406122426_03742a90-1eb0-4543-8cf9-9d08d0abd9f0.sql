
CREATE TABLE public.sop_step_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  step_index integer NOT NULL,
  document_type text NOT NULL DEFAULT 'template',
  title text NOT NULL DEFAULT '',
  content text DEFAULT '',
  file_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sop_step_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sop_step_documents"
  ON public.sop_step_documents
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_sop_step_documents_updated_at
  BEFORE UPDATE ON public.sop_step_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
