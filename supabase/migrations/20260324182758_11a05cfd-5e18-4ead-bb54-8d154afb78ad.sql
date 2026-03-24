ALTER TABLE public.content_items 
ADD COLUMN product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;