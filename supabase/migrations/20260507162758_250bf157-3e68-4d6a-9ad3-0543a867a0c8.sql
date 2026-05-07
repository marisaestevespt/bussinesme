ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS meeting_title_template text;

UPDATE public.project_deliverables pd
SET meeting_title_template = pdt.meeting_title_template
FROM public.product_deliverable_templates pdt
WHERE pd.source_template_id = pdt.id
  AND pd.meeting_title_template IS NULL
  AND pdt.meeting_title_template IS NOT NULL;