-- These are constraint-backed; drop the constraint (PG drops the index too)
ALTER TABLE public.channel_monthly_metrics DROP CONSTRAINT IF EXISTS channel_monthly_metrics_channel_month_year_key;
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_module_unique;

-- These are plain duplicate indexes
DROP INDEX IF EXISTS public.idx_financial_expenses_date;
DROP INDEX IF EXISTS public.idx_launch_data_project;
DROP INDEX IF EXISTS public.idx_time_entries_date;