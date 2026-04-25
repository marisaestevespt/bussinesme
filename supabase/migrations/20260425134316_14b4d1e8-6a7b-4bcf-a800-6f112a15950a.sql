-- Add columns for upload-based documents and tagging
ALTER TABLE public.product_documents
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_type text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_product_documents_product_id ON public.product_documents(product_id);
CREATE INDEX IF NOT EXISTS idx_product_documents_tags ON public.product_documents USING GIN(tags);

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS update_product_documents_updated_at ON public.product_documents;
CREATE TRIGGER update_product_documents_updated_at
  BEFORE UPDATE ON public.product_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();