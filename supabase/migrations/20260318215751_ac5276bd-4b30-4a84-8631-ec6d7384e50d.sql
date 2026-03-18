
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_name text;
