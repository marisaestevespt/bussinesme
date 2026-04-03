ALTER TABLE public.product_onboarding_templates DROP COLUMN IF EXISTS responsible_type;
ALTER TABLE public.product_offboarding_templates DROP COLUMN IF EXISTS responsible_type;
ALTER TABLE public.client_onboarding DROP COLUMN IF EXISTS responsible_type;
ALTER TABLE public.client_offboarding DROP COLUMN IF EXISTS responsible_type;