-- Drop the simple objectives table
DROP TABLE IF EXISTS public.strategy_monthly_objectives;

-- Create the measurable marketing goals table
CREATE TABLE public.marketing_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  channel_id UUID REFERENCES public.marketing_channels(id) ON DELETE SET NULL,
  metric_key TEXT NOT NULL DEFAULT '',
  metric_label TEXT NOT NULL DEFAULT '',
  target_value NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view marketing goals"
  ON public.marketing_goals FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Owners can manage marketing goals"
  ON public.marketing_goals FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_marketing_goals_period ON public.marketing_goals (year, month);