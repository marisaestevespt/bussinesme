
ALTER TABLE public.product_deliverable_templates
ADD COLUMN IF NOT EXISTS linked_sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL;

ALTER TABLE public.project_deliverables
ADD COLUMN IF NOT EXISTS linked_sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL;
