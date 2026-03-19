
-- Recursos: useful links
CREATE TABLE public.marketing_resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'uteis',
  label text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_resource_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view resource links" ON public.marketing_resource_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert resource links" ON public.marketing_resource_links FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update resource links" ON public.marketing_resource_links FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete resource links" ON public.marketing_resource_links FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

-- Banco de Ideias
CREATE TABLE public.marketing_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea text NOT NULL,
  channel text,
  content_type text,
  format text,
  category text NOT NULL DEFAULT 'todas',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view ideas" ON public.marketing_ideas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ideas" ON public.marketing_ideas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ideas" ON public.marketing_ideas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete ideas" ON public.marketing_ideas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));
