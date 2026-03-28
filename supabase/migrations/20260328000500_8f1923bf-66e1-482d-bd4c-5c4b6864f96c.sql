
ALTER TABLE public.sops ADD COLUMN IF NOT EXISTS estimated_time numeric;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL;
