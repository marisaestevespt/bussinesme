
-- Marketing pages for rich text sub-pages
CREATE TABLE public.marketing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL UNIQUE,
  title text NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view marketing pages" ON public.marketing_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can update marketing pages" ON public.marketing_pages FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can insert marketing pages" ON public.marketing_pages FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Marketing channels
CREATE TABLE public.marketing_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  link text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view marketing channels" ON public.marketing_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert marketing channels" ON public.marketing_channels FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update marketing channels" ON public.marketing_channels FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete marketing channels" ON public.marketing_channels FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Content items
CREATE TABLE public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'por_planear',
  funnel_stage text,
  content_type text,
  format text,
  objective text,
  product_name text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  copy_content text,
  cover_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view content items" ON public.content_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert content items" ON public.content_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update content items" ON public.content_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete content items" ON public.content_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Content-channel many-to-many
CREATE TABLE public.content_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_id, channel_id)
);
ALTER TABLE public.content_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view content channels" ON public.content_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert content channels" ON public.content_channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete content channels" ON public.content_channels FOR DELETE TO authenticated USING (true);

-- Content attachments
CREATE TABLE public.content_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'file',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view content attachments" ON public.content_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert content attachments" ON public.content_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners can delete content attachments" ON public.content_attachments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('content-files', 'content-files', true);
CREATE POLICY "Authenticated can view content files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'content-files');
CREATE POLICY "Authenticated can upload content files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'content-files');
CREATE POLICY "Owners can delete content files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'content-files' AND public.has_role(auth.uid(), 'owner'));

-- Triggers for updated_at
CREATE TRIGGER update_marketing_pages_updated_at BEFORE UPDATE ON public.marketing_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_marketing_channels_updated_at BEFORE UPDATE ON public.marketing_channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_items_updated_at BEFORE UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed marketing pages
INSERT INTO public.marketing_pages (page_key, title) VALUES
  ('estrategia', 'Estratégia'),
  ('processos-mkt', 'Processos'),
  ('recursos-mkt', 'Recursos'),
  ('automacoes', 'Automações'),
  ('funis', 'Funis'),
  ('trafego-pago', 'Tráfego Pago');

-- Seed marketing channels
INSERT INTO public.marketing_channels (name, sort_order) VALUES
  ('Instagram', 0), ('Youtube', 1), ('Facebook', 2), ('TikTok', 3),
  ('LinkedIn', 4), ('Pinterest', 5), ('Website', 6);
