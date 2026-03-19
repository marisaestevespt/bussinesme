ALTER TABLE public.tasks ADD COLUMN recurrence_type text DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN recurrence_end text DEFAULT NULL;