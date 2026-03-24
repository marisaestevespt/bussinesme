ALTER TABLE public.sops ADD COLUMN departments text[] DEFAULT '{}';

UPDATE public.sops SET departments = ARRAY[department] WHERE department IS NOT NULL AND (departments IS NULL OR departments = '{}');