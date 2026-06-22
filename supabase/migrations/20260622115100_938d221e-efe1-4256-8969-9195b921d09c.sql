ALTER TABLE public.project_phases
ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;