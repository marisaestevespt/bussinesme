
-- Annual goals (one row per year)
CREATE TABLE public.commercial_annual_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  goal_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_annual_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view annual goals" ON public.commercial_annual_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert annual goals" ON public.commercial_annual_goals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update annual goals" ON public.commercial_annual_goals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete annual goals" ON public.commercial_annual_goals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Product goals
CREATE TABLE public.commercial_product_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  product_name text NOT NULL,
  goal_amount numeric(12,2) NOT NULL DEFAULT 0,
  intention text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_product_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product goals" ON public.commercial_product_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert product goals" ON public.commercial_product_goals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update product goals" ON public.commercial_product_goals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product goals" ON public.commercial_product_goals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Quarterly goals
CREATE TABLE public.commercial_quarterly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  quarter integer NOT NULL,
  goal_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, quarter)
);
ALTER TABLE public.commercial_quarterly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view quarterly goals" ON public.commercial_quarterly_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert quarterly goals" ON public.commercial_quarterly_goals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update quarterly goals" ON public.commercial_quarterly_goals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete quarterly goals" ON public.commercial_quarterly_goals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Monthly goals
CREATE TABLE public.commercial_monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  goal_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);
ALTER TABLE public.commercial_monthly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view monthly goals" ON public.commercial_monthly_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert monthly goals" ON public.commercial_monthly_goals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update monthly goals" ON public.commercial_monthly_goals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete monthly goals" ON public.commercial_monthly_goals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Sales records
CREATE TABLE public.commercial_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id text NOT NULL,
  status text NOT NULL DEFAULT 'na',
  payment_date date,
  description text,
  base_value numeric(12,2) NOT NULL DEFAULT 0,
  invoice_total numeric(12,2) NOT NULL DEFAULT 0,
  product text,
  client text,
  source text,
  documents text,
  sale_month integer,
  sale_quarter integer,
  sale_year integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sales" ON public.commercial_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales" ON public.commercial_sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sales" ON public.commercial_sales FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete sales" ON public.commercial_sales FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
