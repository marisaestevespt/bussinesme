
-- Financial Expenses
CREATE TABLE public.financial_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id text NOT NULL DEFAULT 'S2026-01',
  status text NOT NULL DEFAULT 'por_pagar',
  expense_date date NULL,
  description text NULL,
  category text NOT NULL DEFAULT 'outro',
  base_value numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 23,
  total_with_vat numeric NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT 'portugal',
  documents jsonb DEFAULT '[]'::jsonb,
  expense_month integer NULL,
  expense_quarter integer NULL,
  expense_year integer NULL,
  source_type text NULL,
  source_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view expenses" ON public.financial_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert expenses" ON public.financial_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update expenses" ON public.financial_expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete expenses" ON public.financial_expenses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Financial Subscriptions
CREATE TABLE public.financial_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  value numeric NOT NULL DEFAULT 0,
  periodicity text NOT NULL DEFAULT 'mensal',
  monthly_equivalent numeric NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT 'portugal',
  start_date date NULL,
  renewal_date date NULL,
  status text NOT NULL DEFAULT 'ativo',
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view subscriptions" ON public.financial_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert subscriptions" ON public.financial_subscriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update subscriptions" ON public.financial_subscriptions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete subscriptions" ON public.financial_subscriptions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Financial Documents
CREATE TABLE public.financial_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'outro',
  period_start date NULL,
  period_end date NULL,
  period_month integer NULL,
  period_year integer NULL,
  due_date date NULL,
  status text NOT NULL DEFAULT 'por_submeter',
  document_url text NULL,
  document_name text NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view fin documents" ON public.financial_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fin documents" ON public.financial_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fin documents" ON public.financial_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete fin documents" ON public.financial_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Financial Payroll (Employees)
CREATE TABLE public.financial_payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  collaborator_name text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  gross_salary numeric NOT NULL DEFAULT 0,
  withholding_rate numeric NOT NULL DEFAULT 0,
  withholding_value numeric NOT NULL DEFAULT 0,
  ss_employee numeric NOT NULL DEFAULT 0,
  ss_employer numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'por_pagar',
  expense_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view payroll" ON public.financial_payroll FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert payroll" ON public.financial_payroll FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update payroll" ON public.financial_payroll FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete payroll" ON public.financial_payroll FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Financial Contractors
CREATE TABLE public.financial_contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_name text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  service text NULL,
  value numeric NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT 'portugal',
  documents jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'por_pagar',
  expense_id uuid NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contractors" ON public.financial_contractors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contractors" ON public.financial_contractors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contractors" ON public.financial_contractors FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete contractors" ON public.financial_contractors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Auto-generate expense_id
CREATE OR REPLACE FUNCTION public.generate_expense_id()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  current_year integer;
  next_num integer;
BEGIN
  current_year := EXTRACT(YEAR FROM COALESCE(NEW.expense_date, now()));
  SELECT COALESCE(MAX(
    CASE WHEN expense_id ~ ('^S' || current_year || '-[0-9]+$')
    THEN CAST(SUBSTRING(expense_id FROM LENGTH('S' || current_year || '-') + 1) AS integer)
    ELSE 0 END
  ), 0) + 1 INTO next_num FROM public.financial_expenses;
  IF NEW.expense_id = 'S2026-01' OR NEW.expense_id IS NULL THEN
    NEW.expense_id := 'S' || current_year || '-' || LPAD(next_num::text, 2, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_expense_id BEFORE INSERT ON public.financial_expenses
FOR EACH ROW EXECUTE FUNCTION public.generate_expense_id();
