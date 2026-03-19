
-- Channel reports (PDF uploads per channel)
CREATE TABLE public.channel_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view channel reports" ON public.channel_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert channel reports" ON public.channel_reports FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete channel reports" ON public.channel_reports FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Channel custom pages
CREATE TABLE public.channel_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view channel pages" ON public.channel_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert channel pages" ON public.channel_pages FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update channel pages" ON public.channel_pages FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete channel pages" ON public.channel_pages FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
