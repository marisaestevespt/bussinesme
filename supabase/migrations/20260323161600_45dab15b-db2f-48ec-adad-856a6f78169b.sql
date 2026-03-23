ALTER TABLE public.product_nps_config 
ADD COLUMN IF NOT EXISTS nps_form_url text DEFAULT NULL;