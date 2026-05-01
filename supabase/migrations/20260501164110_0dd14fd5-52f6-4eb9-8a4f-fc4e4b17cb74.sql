ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS welcome_email_banner_url text,
  ADD COLUMN IF NOT EXISTS welcome_email_accent_color text;