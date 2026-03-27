ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scheduled_time text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_interval_days integer DEFAULT NULL;