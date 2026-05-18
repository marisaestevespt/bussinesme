ALTER TABLE public.financial_expenses DROP COLUMN IF EXISTS icon;
ALTER TABLE public.financial_expenses DROP COLUMN IF EXISTS cover_url;
ALTER TABLE public.financial_documents DROP COLUMN IF EXISTS icon;
ALTER TABLE public.financial_documents DROP COLUMN IF EXISTS cover_url;
ALTER TABLE public.fiscal_deadline_completions DROP COLUMN IF EXISTS completion_date;
ALTER TABLE public.fiscal_deadline_completions DROP COLUMN IF EXISTS notes;
ALTER TABLE public.fiscal_monthly_checks DROP COLUMN IF EXISTS notes;