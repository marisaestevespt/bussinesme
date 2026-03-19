
-- Executive Objectives (Objetivos Anuais)
CREATE TABLE public.executive_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  area TEXT NOT NULL DEFAULT 'outro',
  deadline TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'por_iniciar',
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.executive_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage executive_objectives" ON public.executive_objectives FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_executive_objectives_updated_at BEFORE UPDATE ON public.executive_objectives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Executive Goals (Metas)
CREATE TABLE public.executive_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'outro',
  status TEXT NOT NULL DEFAULT 'por_iniciar',
  target_date TEXT,
  achieved_date TEXT,
  month INTEGER,
  quarter INTEGER,
  objective_id UUID REFERENCES public.executive_objectives(id) ON DELETE SET NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.executive_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage executive_goals" ON public.executive_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_executive_goals_updated_at BEFORE UPDATE ON public.executive_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Brain Dump (quick to-dos)
CREATE TABLE public.executive_brain_dump (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.executive_brain_dump ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage executive_brain_dump" ON public.executive_brain_dump FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Monthly Checklists (free checklist per month in planeamento mensal)
CREATE TABLE public.executive_monthly_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  task TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.executive_monthly_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage executive_monthly_checklists" ON public.executive_monthly_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Quarterly Analysis (4 text fields per quarter)
CREATE TABLE public.executive_quarterly_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quarter INTEGER NOT NULL,
  year INTEGER NOT NULL,
  went_well TEXT,
  went_wrong TEXT,
  lessons TEXT,
  adjustments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quarter, year)
);
ALTER TABLE public.executive_quarterly_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage executive_quarterly_analysis" ON public.executive_quarterly_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_executive_quarterly_analysis_updated_at BEFORE UPDATE ON public.executive_quarterly_analysis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Weekly Sales Routines (resets every Monday)
CREATE TABLE public.executive_weekly_routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start TEXT NOT NULL,
  routine_key TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(week_start, routine_key)
);
ALTER TABLE public.executive_weekly_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage executive_weekly_routines" ON public.executive_weekly_routines FOR ALL TO authenticated USING (true) WITH CHECK (true);
