
-- Channel monthly metrics (followers, growth, notes per channel per month)
CREATE TABLE public.channel_monthly_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  channel_id UUID NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  followers INTEGER,
  followers_growth INTEGER,
  notes TEXT,
  UNIQUE(channel_id, month, year)
);

ALTER TABLE public.channel_monthly_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view channel_monthly_metrics"
  ON public.channel_monthly_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert channel_monthly_metrics"
  ON public.channel_monthly_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update channel_monthly_metrics"
  ON public.channel_monthly_metrics FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete channel_monthly_metrics"
  ON public.channel_monthly_metrics FOR DELETE TO authenticated USING (true);

-- Content metrics (per content per channel per month)
CREATE TABLE public.content_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  content_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  format TEXT,
  views INTEGER,
  reach INTEGER,
  impressions INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  avg_watch_time NUMERIC,
  watch_hours NUMERIC,
  new_subscribers INTEGER,
  ctr NUMERIC,
  story_replies INTEGER,
  story_link_clicks INTEGER,
  story_exits INTEGER,
  pin_link_clicks INTEGER,
  email_sent INTEGER,
  email_open_rate NUMERIC,
  email_click_rate NUMERIC,
  email_unsubscribes INTEGER,
  UNIQUE(content_id, channel_id, month, year)
);

ALTER TABLE public.content_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view content_metrics"
  ON public.content_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert content_metrics"
  ON public.content_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update content_metrics"
  ON public.content_metrics FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete content_metrics"
  ON public.content_metrics FOR DELETE TO authenticated USING (true);

-- Marketing monthly analysis (qualitative notes per month)
CREATE TABLE public.marketing_monthly_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  what_went_well TEXT,
  what_went_wrong TEXT,
  UNIQUE(month, year)
);

ALTER TABLE public.marketing_monthly_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view marketing_monthly_analysis"
  ON public.marketing_monthly_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert marketing_monthly_analysis"
  ON public.marketing_monthly_analysis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update marketing_monthly_analysis"
  ON public.marketing_monthly_analysis FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete marketing_monthly_analysis"
  ON public.marketing_monthly_analysis FOR DELETE TO authenticated USING (true);
