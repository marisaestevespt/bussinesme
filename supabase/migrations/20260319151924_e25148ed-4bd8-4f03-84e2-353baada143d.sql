
-- Product offboarding templates (mirror of onboarding templates)
CREATE TABLE public.product_offboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  phase TEXT,
  activity TEXT NOT NULL DEFAULT '',
  responsible TEXT,
  rule TEXT,
  documents_links TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_offboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view offboarding templates"
  ON public.product_offboarding_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert offboarding templates"
  ON public.product_offboarding_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update offboarding templates"
  ON public.product_offboarding_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete offboarding templates"
  ON public.product_offboarding_templates FOR DELETE TO authenticated USING (true);

-- Client offboarding checklist (mirror of client_onboarding)
CREATE TABLE public.client_offboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  phase TEXT,
  activity TEXT NOT NULL DEFAULT '',
  responsible TEXT,
  rule TEXT,
  completed BOOLEAN DEFAULT false,
  documents_links TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_offboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client offboarding"
  ON public.client_offboarding FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client offboarding"
  ON public.client_offboarding FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client offboarding"
  ON public.client_offboarding FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client offboarding"
  ON public.client_offboarding FOR DELETE TO authenticated USING (true);
