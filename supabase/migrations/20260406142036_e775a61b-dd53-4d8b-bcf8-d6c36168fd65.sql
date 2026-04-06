
-- Add group_sort_order to both tables
ALTER TABLE public.product_diagnostic_questions ADD COLUMN IF NOT EXISTS group_sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.portal_initial_questions ADD COLUMN IF NOT EXISTS group_sort_order integer NOT NULL DEFAULT 0;
