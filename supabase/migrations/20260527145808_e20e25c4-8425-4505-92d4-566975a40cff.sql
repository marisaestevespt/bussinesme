ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks(lead_id);