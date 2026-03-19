
CREATE TABLE public.commercial_strategy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Estratégia de Vendas',
  period text NOT NULL DEFAULT '2026',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_strategy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read strategy"
  ON public.commercial_strategy FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert strategy"
  ON public.commercial_strategy FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update strategy"
  ON public.commercial_strategy FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
