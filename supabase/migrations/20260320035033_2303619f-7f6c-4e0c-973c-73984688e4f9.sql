
CREATE TABLE public.clients_monthly_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  portfolio_notes TEXT,
  what_went_well TEXT,
  what_went_wrong TEXT,
  UNIQUE (month, year)
);

ALTER TABLE public.clients_monthly_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client analysis"
  ON public.clients_monthly_analysis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client analysis"
  ON public.clients_monthly_analysis FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client analysis"
  ON public.clients_monthly_analysis FOR UPDATE TO authenticated USING (true);
