
-- Client NPS records (linked to a client, generated from product NPS config)
CREATE TABLE public.client_nps_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  expected_date DATE NOT NULL,
  actual_date DATE,
  nps_score INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'por_fazer',
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_nps_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage client NPS records" ON public.client_nps_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_client_nps_records_updated_at BEFORE UPDATE ON public.client_nps_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Client milestones (linked to a client, generated from product milestones)
CREATE TABLE public.client_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  milestone TEXT NOT NULL DEFAULT '',
  expected_date DATE NOT NULL,
  milestone_type TEXT NOT NULL DEFAULT 'check_in',
  responsible_id UUID,
  status TEXT NOT NULL DEFAULT 'por_fazer',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage client milestones" ON public.client_milestones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_client_milestones_updated_at BEFORE UPDATE ON public.client_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
