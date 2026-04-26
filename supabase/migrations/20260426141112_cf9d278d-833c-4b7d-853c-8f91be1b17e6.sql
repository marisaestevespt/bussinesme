CREATE TABLE public.dismissed_ceo_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_key TEXT NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_key)
);

ALTER TABLE public.dismissed_ceo_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dismissed alerts"
ON public.dismissed_ceo_alerts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dismissed alerts"
ON public.dismissed_ceo_alerts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own dismissed alerts"
ON public.dismissed_ceo_alerts FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_dismissed_ceo_alerts_user ON public.dismissed_ceo_alerts(user_id);