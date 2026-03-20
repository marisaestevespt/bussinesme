-- Add task_id to client_nps_records to track auto-generated tasks
ALTER TABLE public.client_nps_records
ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;