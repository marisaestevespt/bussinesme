-- Add renewal_advance_days to products table
ALTER TABLE public.products
ADD COLUMN renewal_advance_days integer DEFAULT 30;

COMMENT ON COLUMN public.products.renewal_advance_days IS 'Number of days before end_of_cycle to start the renewal process. Default 30.';
