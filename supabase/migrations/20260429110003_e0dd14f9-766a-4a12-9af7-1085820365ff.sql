-- Sales kit fields directly on products (single record per product, simple JSON for lists)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sales_presentation_url text,
  ADD COLUMN IF NOT EXISTS sales_pitch text,
  ADD COLUMN IF NOT EXISTS sales_benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sales_materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sales_faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sales_objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sales_case_studies jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.sales_benefits     IS 'Array of {title,description} bullets para vendedores';
COMMENT ON COLUMN public.products.sales_materials    IS 'Array of {name,url,type} (PDF, vídeo, link, etc.)';
COMMENT ON COLUMN public.products.sales_faqs         IS 'Array of {question,answer} para vendedores responderem';
COMMENT ON COLUMN public.products.sales_objections   IS 'Array of {objection,response} objeções comuns + resposta';
COMMENT ON COLUMN public.products.sales_case_studies IS 'Array of {client,result,description} mini-cases / testemunhos';