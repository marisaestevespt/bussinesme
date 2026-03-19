
-- Business Plan settings (value proposition)
CREATE TABLE public.business_plan_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value_proposition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_plan_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.business_plan_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Business Plan kanban cards
CREATE TABLE public.business_plan_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key text NOT NULL,
  content text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_plan_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.business_plan_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Business Plan custom columns (beyond the 7 fixed ones)
CREATE TABLE public.business_plan_custom_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.business_plan_custom_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.business_plan_custom_columns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Innovation ideas table
CREATE TABLE public.innovation_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea text NOT NULL,
  context text NOT NULL DEFAULT 'outro',
  plan text NOT NULL DEFAULT 'curto',
  created_at timestamptz NOT NULL DEFAULT now(),
  implementation_date date,
  completed boolean NOT NULL DEFAULT false
);
ALTER TABLE public.innovation_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.innovation_ideas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Innovation docs (estudos & referencias)
CREATE TABLE public.innovation_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key text NOT NULL UNIQUE,
  content text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.innovation_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.innovation_docs FOR ALL TO authenticated USING (true) WITH CHECK (true);
