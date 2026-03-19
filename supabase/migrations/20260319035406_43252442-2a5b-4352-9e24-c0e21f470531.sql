
-- Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'em_ideia',
  sales_page_url text,
  ticket text,
  escada text,
  product_type text,
  sales_type text,
  drive_url text,
  important_dates jsonb DEFAULT '[]'::jsonb,
  about_content text,
  included_items jsonb DEFAULT '[]'::jsonb,
  faqs jsonb DEFAULT '[{"question":"","answer":""},{"question":"","answer":""},{"question":"","answer":""}]'::jsonb,
  client_profile jsonb DEFAULT '{"dificuldades":[],"dores":[],"desejo":[],"pensa":[],"expressoes":[],"ouve":[],"linguagem_nucleo":[],"linguagem_apoio":[],"linguagem_evitar":[]}'::jsonb,
  competitors jsonb DEFAULT '[{"name":"Produto 1","notes":""},{"name":"Produto 2","notes":""},{"name":"Produto 3","notes":""},{"name":"Produto 4","notes":""}]'::jsonb,
  improvements_content text,
  brainstorming_content text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update products" ON public.products FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete products" ON public.products FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Product feedbacks
CREATE TABLE public.product_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  feedback text DEFAULT '',
  client_name text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product feedbacks" ON public.product_feedbacks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert product feedbacks" ON public.product_feedbacks FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update product feedbacks" ON public.product_feedbacks FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product feedbacks" ON public.product_feedbacks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Product funnels (local to product)
CREATE TABLE public.product_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'em_ideia',
  entry_points jsonb DEFAULT '[]'::jsonb,
  offer text,
  objective text,
  platforms jsonb DEFAULT '[]'::jsonb,
  funnel_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product funnels" ON public.product_funnels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert product funnels" ON public.product_funnels FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update product funnels" ON public.product_funnels FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product funnels" ON public.product_funnels FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_product_funnels_updated_at BEFORE UPDATE ON public.product_funnels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Product automations (local to product)
CREATE TABLE public.product_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'em_desenho',
  offer text,
  platform text,
  objective text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product automations" ON public.product_automations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert product automations" ON public.product_automations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update product automations" ON public.product_automations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product automations" ON public.product_automations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_product_automations_updated_at BEFORE UPDATE ON public.product_automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Product traffic ads
CREATE TABLE public.product_traffic_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  start_date date,
  creative_url text,
  status text DEFAULT 'ativo',
  format text,
  objective text,
  offer_goal text,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_traffic_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product traffic ads" ON public.product_traffic_ads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert product traffic ads" ON public.product_traffic_ads FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update product traffic ads" ON public.product_traffic_ads FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product traffic ads" ON public.product_traffic_ads FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Product useful links
CREATE TABLE public.product_useful_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text DEFAULT '',
  url text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_useful_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product useful links" ON public.product_useful_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert product useful links" ON public.product_useful_links FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update product useful links" ON public.product_useful_links FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product useful links" ON public.product_useful_links FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Product costs
CREATE TABLE public.product_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text DEFAULT '',
  usage_desc text DEFAULT '',
  value numeric DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product costs" ON public.product_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert product costs" ON public.product_costs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update product costs" ON public.product_costs FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product costs" ON public.product_costs FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Product KPI reports by month
CREATE TABLE public.product_kpi_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_kpi_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product kpi reports" ON public.product_kpi_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert product kpi reports" ON public.product_kpi_reports FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update product kpi reports" ON public.product_kpi_reports FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product kpi reports" ON public.product_kpi_reports FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_product_kpi_reports_updated_at BEFORE UPDATE ON public.product_kpi_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
