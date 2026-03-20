
ALTER TABLE public.routines
  ADD COLUMN monthly_day integer,
  ADD COLUMN start_date date,
  ADD COLUMN end_date date;
