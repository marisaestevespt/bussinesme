-- 1. Suppliers table
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nif text,
  email text,
  phone text,
  address text,
  website text,
  category text DEFAULT 'outro',
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 2. Add supplier_id FK to expenses
ALTER TABLE public.financial_expenses
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

-- 3. Financial goals table (separate from commercial)
CREATE TABLE public.financial_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue_target numeric DEFAULT 0,
  expense_target numeric DEFAULT 0,
  profit_target numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (year, month)
);

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage financial goals"
  ON public.financial_goals FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Enable realtime for financial tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;