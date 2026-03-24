CREATE TABLE public.product_deliverable_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_deliverable_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product deliverable templates"
ON public.product_deliverable_templates
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);