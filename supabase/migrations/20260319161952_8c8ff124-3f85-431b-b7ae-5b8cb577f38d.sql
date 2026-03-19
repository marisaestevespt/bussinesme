
-- Add missing columns to internal_documents for the Equipa page
ALTER TABLE public.internal_documents ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'outro';
ALTER TABLE public.internal_documents ADD COLUMN IF NOT EXISTS version text DEFAULT 'v1.0';
ALTER TABLE public.internal_documents ADD COLUMN IF NOT EXISTS responsible_id uuid;
ALTER TABLE public.internal_documents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';
ALTER TABLE public.internal_documents ADD COLUMN IF NOT EXISTS notes text;
