
-- Add structured rule columns to product_onboarding_templates
ALTER TABLE public.product_onboarding_templates
  ADD COLUMN IF NOT EXISTS rule_days integer,
  ADD COLUMN IF NOT EXISTS rule_unit text DEFAULT 'dias_uteis',
  ADD COLUMN IF NOT EXISTS rule_trigger text DEFAULT 'inicio_cliente';

-- Add structured rule columns to product_offboarding_templates
ALTER TABLE public.product_offboarding_templates
  ADD COLUMN IF NOT EXISTS rule_days integer,
  ADD COLUMN IF NOT EXISTS rule_unit text DEFAULT 'dias_uteis',
  ADD COLUMN IF NOT EXISTS rule_trigger text DEFAULT 'inicio_cliente';

-- Add structured rule columns to client_onboarding
ALTER TABLE public.client_onboarding
  ADD COLUMN IF NOT EXISTS rule_days integer,
  ADD COLUMN IF NOT EXISTS rule_unit text DEFAULT 'dias_uteis',
  ADD COLUMN IF NOT EXISTS rule_trigger text DEFAULT 'inicio_cliente';

-- Add structured rule columns to client_offboarding
ALTER TABLE public.client_offboarding
  ADD COLUMN IF NOT EXISTS rule_days integer,
  ADD COLUMN IF NOT EXISTS rule_unit text DEFAULT 'dias_uteis',
  ADD COLUMN IF NOT EXISTS rule_trigger text DEFAULT 'inicio_cliente';
