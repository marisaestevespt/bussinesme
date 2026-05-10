ALTER TABLE public.member_onboarding DROP COLUMN IF EXISTS source_template_id;
DROP TABLE IF EXISTS public.sop_onboarding_items CASCADE;
DROP TABLE IF EXISTS public.sop_onboarding_templates CASCADE;