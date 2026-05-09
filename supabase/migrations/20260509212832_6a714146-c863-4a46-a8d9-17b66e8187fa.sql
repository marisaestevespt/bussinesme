-- 1) Permitir source_type = 'tax' em financial_expenses
ALTER TABLE public.financial_expenses
  DROP CONSTRAINT IF EXISTS financial_expenses_source_type_check;
ALTER TABLE public.financial_expenses
  ADD CONSTRAINT financial_expenses_source_type_check
  CHECK (source_type IS NULL OR source_type = ANY (ARRAY['manual','rule','subscription','contract','contractor','payroll','tax']));

-- 2) Tabela de pagamentos de IVA por trimestre
CREATE TABLE IF NOT EXISTS public.iva_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  paid_amount numeric NOT NULL DEFAULT 0,
  paid_date date,
  expense_id uuid REFERENCES public.financial_expenses(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, quarter)
);

ALTER TABLE public.iva_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view iva payments"
  ON public.iva_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert iva payments"
  ON public.iva_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update iva payments"
  ON public.iva_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete iva payments"
  ON public.iva_payments FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_iva_payments_updated_at
  BEFORE UPDATE ON public.iva_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();