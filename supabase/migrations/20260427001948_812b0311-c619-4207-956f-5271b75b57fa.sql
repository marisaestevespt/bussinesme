
-- Realinha schema para espelhar product_onboarding_templates
ALTER TABLE public.product_renewal_templates
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS activity text,
  ADD COLUMN IF NOT EXISTS responsible text,
  ADD COLUMN IF NOT EXISTS rule text,
  ADD COLUMN IF NOT EXISTS documents_links text;

-- Migra dados existentes (name -> activity)
UPDATE public.product_renewal_templates
SET activity = COALESCE(activity, name)
WHERE activity IS NULL AND name IS NOT NULL;

-- Torna activity obrigatório como em onboarding
ALTER TABLE public.product_renewal_templates
  ALTER COLUMN name DROP NOT NULL;
