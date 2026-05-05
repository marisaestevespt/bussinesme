
CREATE TABLE public.brand_folder_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_folder_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brand folder links"
  ON public.brand_folder_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can insert brand folder links"
  ON public.brand_folder_links FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can update brand folder links"
  ON public.brand_folder_links FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete brand folder links"
  ON public.brand_folder_links FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_brand_folder_links_updated_at
  BEFORE UPDATE ON public.brand_folder_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
