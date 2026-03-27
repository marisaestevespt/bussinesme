ALTER TABLE public.planning_routines 
  ADD COLUMN IF NOT EXISTS sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_time numeric;