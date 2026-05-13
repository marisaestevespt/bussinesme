-- Make file fields optional and add new fields for typed step documents
ALTER TABLE public.sop_step_documents
  ALTER COLUMN file_name DROP NOT NULL,
  ALTER COLUMN file_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'documento',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS step_index integer NOT NULL DEFAULT 0;

-- Validate document_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sop_step_documents_document_type_check'
  ) THEN
    ALTER TABLE public.sop_step_documents
      ADD CONSTRAINT sop_step_documents_document_type_check
      CHECK (document_type IN ('email','mensagem','documento','template','link','ficheiro'));
  END IF;
END $$;

-- Link onboarding items back to their SOP step (so we can show its docs)
ALTER TABLE public.member_onboarding
  ADD COLUMN IF NOT EXISTS sop_step_id uuid REFERENCES public.sop_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_member_onboarding_sop_step_id
  ON public.member_onboarding(sop_step_id);
