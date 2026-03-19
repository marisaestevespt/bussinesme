
CREATE TABLE public.traffic_report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.traffic_report_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view traffic report cards" ON public.traffic_report_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert traffic report cards" ON public.traffic_report_cards FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update traffic report cards" ON public.traffic_report_cards FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete traffic report cards" ON public.traffic_report_cards FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_traffic_report_cards_updated_at BEFORE UPDATE ON public.traffic_report_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.traffic_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'em_desenho',
  start_date date,
  formato text,
  objetivo text,
  oferta_goal text,
  link text,
  titulo_principal text,
  headline text,
  legenda text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.traffic_creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view traffic creatives" ON public.traffic_creatives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert traffic creatives" ON public.traffic_creatives FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update traffic creatives" ON public.traffic_creatives FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete traffic creatives" ON public.traffic_creatives FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_traffic_creatives_updated_at BEFORE UPDATE ON public.traffic_creatives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.traffic_report_cards (title, content, sort_order) VALUES ('Reports', null, 0);
