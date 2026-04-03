-- Add responsible_type to product onboarding templates
ALTER TABLE public.product_onboarding_templates
ADD COLUMN responsible_type text NOT NULL DEFAULT 'equipa';

-- Add responsible_type to product offboarding templates
ALTER TABLE public.product_offboarding_templates
ADD COLUMN responsible_type text NOT NULL DEFAULT 'equipa';

-- Add responsible_type to client onboarding
ALTER TABLE public.client_onboarding
ADD COLUMN responsible_type text NOT NULL DEFAULT 'equipa';

-- Add responsible_type to client offboarding
ALTER TABLE public.client_offboarding
ADD COLUMN responsible_type text NOT NULL DEFAULT 'equipa';