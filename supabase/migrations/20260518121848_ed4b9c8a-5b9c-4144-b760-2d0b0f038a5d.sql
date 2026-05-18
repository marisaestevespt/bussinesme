
ALTER TABLE public.project_deliverables
ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
