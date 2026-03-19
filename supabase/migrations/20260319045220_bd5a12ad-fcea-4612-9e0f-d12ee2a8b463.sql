ALTER TABLE public.products ADD COLUMN cycle_duration integer NULL;
COMMENT ON COLUMN public.products.cycle_duration IS 'Duration of cycle/access in days';