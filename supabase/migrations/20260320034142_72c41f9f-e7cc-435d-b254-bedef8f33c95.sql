
CREATE TABLE public.commercial_monthly_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  main_objections TEXT,
  active_actions_results TEXT,
  what_went_well TEXT,
  what_went_wrong TEXT,
  UNIQUE (month, year)
);

ALTER TABLE public.commercial_monthly_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view commercial analysis"
  ON public.commercial_monthly_analysis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert commercial analysis"
  ON public.commercial_monthly_analysis FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update commercial analysis"
  ON public.commercial_monthly_analysis FOR UPDATE TO authenticated USING (true);
