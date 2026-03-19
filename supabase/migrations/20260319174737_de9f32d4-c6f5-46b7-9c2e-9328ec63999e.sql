
-- NPS Configuration per product
CREATE TABLE public.product_nps_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  cadence_days INTEGER NOT NULL DEFAULT 90,
  collection_message TEXT,
  responsible_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

ALTER TABLE public.product_nps_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage product_nps_config" ON public.product_nps_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_product_nps_config_updated_at BEFORE UPDATE ON public.product_nps_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product Milestones (templates applied to clients)
CREATE TABLE public.product_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL DEFAULT '',
  days_after_start INTEGER NOT NULL DEFAULT 0,
  milestone_type TEXT NOT NULL DEFAULT 'check_in',
  responsible_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage product_milestones" ON public.product_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_product_milestones_updated_at BEFORE UPDATE ON public.product_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NPS Records (created from client pages, read-only in product page)
CREATE TABLE public.product_nps_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL DEFAULT '',
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'por_fazer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_nps_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage product_nps_records" ON public.product_nps_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
