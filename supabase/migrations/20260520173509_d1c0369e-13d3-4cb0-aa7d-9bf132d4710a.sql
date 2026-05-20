
CREATE TABLE IF NOT EXISTS public.quarterly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  year integer NOT NULL,
  quarter text NOT NULL CHECK (quarter IN ('T1','T2','T3','T4')),
  theme text,
  retrospective text,
  capacity_notes text,
  financial_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area, year, quarter)
);

CREATE INDEX IF NOT EXISTS idx_qp_year_q ON public.quarterly_plans (year, quarter);

ALTER TABLE public.quarterly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view qp" ON public.quarterly_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth ins qp" ON public.quarterly_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth upd qp" ON public.quarterly_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth del qp" ON public.quarterly_plans FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_qp_updated BEFORE UPDATE ON public.quarterly_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.quarterly_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  year integer NOT NULL,
  quarter text NOT NULL CHECK (quarter IN ('T1','T2','T3','T4')),
  kind text NOT NULL CHECK (kind IN ('priority','risk','milestone','learning')),
  title text NOT NULL,
  description text,
  severity text,
  mitigation text,
  due_date date,
  status text NOT NULL DEFAULT 'por_iniciar',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qi_area_year_q ON public.quarterly_items (area, year, quarter, kind);

ALTER TABLE public.quarterly_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view qi" ON public.quarterly_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth ins qi" ON public.quarterly_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth upd qi" ON public.quarterly_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth del qi" ON public.quarterly_items FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_qi_updated BEFORE UPDATE ON public.quarterly_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
