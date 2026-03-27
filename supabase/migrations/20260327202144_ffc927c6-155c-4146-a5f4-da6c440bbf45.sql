-- Add new columns to product_project_templates
ALTER TABLE public.product_project_templates
  ADD COLUMN IF NOT EXISTS rule text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS is_subtask boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_template_id uuid REFERENCES public.product_project_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_time numeric,
  ADD COLUMN IF NOT EXISTS notes text;

-- Migrate phase data to rule if any exists, then drop phase
UPDATE public.product_project_templates SET rule = phase WHERE phase IS NOT NULL AND phase != '';
ALTER TABLE public.product_project_templates DROP COLUMN IF EXISTS phase;