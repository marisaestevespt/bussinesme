ALTER TABLE public.product_deliverable_templates 
  ADD COLUMN IF NOT EXISTS meeting_title_template text;

COMMENT ON COLUMN public.product_deliverable_templates.meeting_title_template IS
  'Padrão de título para a reunião criada a partir desta entrega. Suporta {N} (nº sequencial entre entregas com mesmo template no projeto) e {cliente} (nome do cliente).';