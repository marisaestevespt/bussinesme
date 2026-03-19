
CREATE TABLE public.brand_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'direta',
  instagram TEXT,
  website TEXT,
  produtos TEXT,
  precos TEXT,
  plataformas TEXT,
  posicionamento TEXT,
  comunicacao TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brand competitors" ON public.brand_competitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand competitors" ON public.brand_competitors FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update brand competitors" ON public.brand_competitors FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete brand competitors" ON public.brand_competitors FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
