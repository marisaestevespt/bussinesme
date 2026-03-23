ALTER TABLE public.marketing_funnels ADD COLUMN IF NOT EXISTS product_name text DEFAULT NULL;
ALTER TABLE public.marketing_automations ADD COLUMN IF NOT EXISTS product_name text DEFAULT NULL;
ALTER TABLE public.traffic_creatives ADD COLUMN IF NOT EXISTS product_name text DEFAULT NULL;