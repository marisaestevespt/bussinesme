-- Tabela para documentos legais do negócio (abertura de atividade, certidão permanente, pacto social, etc.)
CREATE TABLE IF NOT EXISTS public.business_legal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_legal_documents ENABLE ROW LEVEL SECURITY;

-- Equipa autenticada lê
CREATE POLICY "Authenticated users can view legal documents"
ON public.business_legal_documents
FOR SELECT
TO authenticated
USING (true);

-- Só owner gere (insert/update/delete)
CREATE POLICY "Only owners can insert legal documents"
ON public.business_legal_documents
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Only owners can update legal documents"
ON public.business_legal_documents
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Only owners can delete legal documents"
ON public.business_legal_documents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_business_legal_documents_updated_at
BEFORE UPDATE ON public.business_legal_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para os documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-legal-docs', 'business-legal-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Equipa autenticada pode ler ficheiros
CREATE POLICY "Authenticated users can view legal doc files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'business-legal-docs');

-- Só owner pode fazer upload
CREATE POLICY "Only owners can upload legal doc files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'business-legal-docs' AND public.has_role(auth.uid(), 'owner'));

-- Só owner pode atualizar
CREATE POLICY "Only owners can update legal doc files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'business-legal-docs' AND public.has_role(auth.uid(), 'owner'));

-- Só owner pode apagar
CREATE POLICY "Only owners can delete legal doc files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'business-legal-docs' AND public.has_role(auth.uid(), 'owner'));