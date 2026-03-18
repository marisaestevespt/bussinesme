
ALTER TABLE public.events ALTER COLUMN start_date TYPE timestamptz USING start_date::timestamptz;
ALTER TABLE public.events ALTER COLUMN end_date TYPE timestamptz USING end_date::timestamptz;
