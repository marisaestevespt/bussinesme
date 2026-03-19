CREATE TABLE public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type text NOT NULL DEFAULT 'expense',
  value text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read financial categories"
  ON public.financial_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert financial categories"
  ON public.financial_categories FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete financial categories"
  ON public.financial_categories FOR DELETE TO authenticated USING (true);

CREATE UNIQUE INDEX financial_categories_type_value ON public.financial_categories(category_type, value);