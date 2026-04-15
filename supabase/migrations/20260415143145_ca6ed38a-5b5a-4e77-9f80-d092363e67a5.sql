CREATE TABLE public.strategy_monthly_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.strategy_monthly_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view objectives"
  ON public.strategy_monthly_objectives FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Owners can manage objectives"
  ON public.strategy_monthly_objectives FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));