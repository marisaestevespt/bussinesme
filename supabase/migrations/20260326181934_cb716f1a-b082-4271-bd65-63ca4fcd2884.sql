ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);