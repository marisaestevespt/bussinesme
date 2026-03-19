
-- Template de tarefas de projeto por produto
CREATE TABLE public.product_project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL DEFAULT '',
  phase TEXT,
  responsible TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_project_templates"
  ON public.product_project_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_project_templates"
  ON public.product_project_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_project_templates"
  ON public.product_project_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete product_project_templates"
  ON public.product_project_templates FOR DELETE TO authenticated USING (true);
