-- Add payment_method and payment_config to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS payment_config jsonb;

-- Create fiscal deadline completions table
CREATE TABLE IF NOT EXISTS public.fiscal_deadline_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_key text NOT NULL,
  year integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(deadline_key, year)
);

ALTER TABLE public.fiscal_deadline_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fiscal completions"
ON public.fiscal_deadline_completions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert fiscal completions"
ON public.fiscal_deadline_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = completed_by);

CREATE POLICY "Authenticated users can delete fiscal completions"
ON public.fiscal_deadline_completions FOR DELETE TO authenticated USING (auth.uid() = completed_by);