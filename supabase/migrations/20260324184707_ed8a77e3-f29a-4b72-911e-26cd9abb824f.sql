ALTER TABLE public.meetings ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE SET NULL DEFAULT NULL;
ALTER TABLE public.meetings ADD COLUMN product_name TEXT DEFAULT NULL;