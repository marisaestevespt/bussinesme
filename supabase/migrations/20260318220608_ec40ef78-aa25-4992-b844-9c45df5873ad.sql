ALTER TABLE public.events
  ADD COLUMN recurrence_type text DEFAULT NULL,
  ADD COLUMN recurrence_end date DEFAULT NULL;