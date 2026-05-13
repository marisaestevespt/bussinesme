-- Add new deliverable types
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'mensagem';

-- Add content fields to product deliverable templates
ALTER TABLE public.product_deliverable_templates
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS message_body text;

-- Mirror on project deliverables (so cascaded entregas keep content per-cliente, with template defaults)
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS document_file_path text,
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS message_body text;