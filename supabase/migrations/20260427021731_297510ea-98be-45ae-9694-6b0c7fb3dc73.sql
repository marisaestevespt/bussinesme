ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_legacy boolean NOT NULL DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS legacy_product_description text;
CREATE INDEX IF NOT EXISTS idx_clients_is_legacy ON public.clients(is_legacy) WHERE is_legacy = true;