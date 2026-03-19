
CREATE TABLE public.brand_swot_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quadrant TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_swot_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view brand swot" ON public.brand_swot_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand swot" ON public.brand_swot_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update brand swot" ON public.brand_swot_items FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete brand swot" ON public.brand_swot_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TABLE public.brand_differentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_differentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view brand differentials" ON public.brand_differentials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand differentials" ON public.brand_differentials FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete brand differentials" ON public.brand_differentials FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
