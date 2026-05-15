ALTER TABLE public.product_deliverable_templates
  ADD COLUMN IF NOT EXISTS recurrence_week_of_month integer
  CHECK (recurrence_week_of_month IS NULL OR recurrence_week_of_month BETWEEN 1 AND 5);

COMMENT ON COLUMN public.product_deliverable_templates.recurrence_week_of_month IS
  'When cadence=propria + mensal: 1..4 = Nth weekday of month, 5 = last weekday of month. NULL means use recurrence_anchor_day as day-of-month.';