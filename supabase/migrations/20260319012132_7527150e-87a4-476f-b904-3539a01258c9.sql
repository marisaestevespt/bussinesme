
-- Website pages table
CREATE TABLE public.website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.marketing_channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  copy_content text,
  status text NOT NULL DEFAULT 'por_comecar',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view website pages" ON public.website_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert website pages" ON public.website_pages FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update website pages" ON public.website_pages FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete website pages" ON public.website_pages FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Website page design inspirations (file uploads)
CREATE TABLE public.website_page_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.website_pages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.website_page_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view website page files" ON public.website_page_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert website page files" ON public.website_page_files FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete website page files" ON public.website_page_files FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
