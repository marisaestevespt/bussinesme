
CREATE TABLE public.fiscal_monthly_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  check_key TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month, check_key)
);

ALTER TABLE public.fiscal_monthly_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage fiscal checks"
  ON public.fiscal_monthly_checks FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
