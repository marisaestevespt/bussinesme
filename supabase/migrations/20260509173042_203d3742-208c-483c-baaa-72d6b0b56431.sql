-- P1: drop órfãos
ALTER TABLE public.products DROP COLUMN IF EXISTS important_dates;
ALTER TABLE public.products DROP COLUMN IF EXISTS improvements_content;
DROP TABLE IF EXISTS public.product_project_templates CASCADE;