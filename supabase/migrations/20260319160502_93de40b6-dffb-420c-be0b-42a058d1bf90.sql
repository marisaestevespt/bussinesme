
-- Team Members (central source of all business members)
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  role_title TEXT,
  email TEXT,
  whatsapp TEXT,
  work_schedule TEXT,
  identification TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  member_type TEXT NOT NULL DEFAULT 'colaborador_fixo',
  start_date TEXT,
  presentation TEXT,
  responsibilities TEXT,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage team_members" ON public.team_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Member Onboarding Checklist
CREATE TABLE public.member_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage member_onboarding" ON public.member_onboarding FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Performance Weekly
CREATE TABLE public.performance_weekly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_overdue INTEGER DEFAULT 0,
  projects_active INTEGER DEFAULT 0,
  notes TEXT,
  overall_status TEXT NOT NULL DEFAULT 'dentro_esperado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.performance_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage performance_weekly" ON public.performance_weekly FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_performance_weekly_updated_at BEFORE UPDATE ON public.performance_weekly FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Performance Monthly
CREATE TABLE public.performance_monthly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_overdue INTEGER DEFAULT 0,
  projects_active INTEGER DEFAULT 0,
  hours_worked NUMERIC DEFAULT 0,
  rating INTEGER,
  comments TEXT,
  notes TEXT,
  overall_status TEXT NOT NULL DEFAULT 'dentro_esperado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.performance_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage performance_monthly" ON public.performance_monthly FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_performance_monthly_updated_at BEFORE UPDATE ON public.performance_monthly FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Feedback Sessions
CREATE TABLE public.feedback_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'feedback_formal',
  went_well TEXT,
  to_improve TEXT,
  agreements TEXT,
  next_session TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage feedback_sessions" ON public.feedback_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_feedback_sessions_updated_at BEFORE UPDATE ON public.feedback_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Member Contracts
CREATE TABLE public.member_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL DEFAULT 'contrato_trabalho',
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage member_contracts" ON public.member_contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_member_contracts_updated_at BEFORE UPDATE ON public.member_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Member Payments
CREATE TABLE public.member_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'salario',
  gross_value NUMERIC NOT NULL DEFAULT 0,
  net_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'por_pagar',
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.member_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage member_payments" ON public.member_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_member_payments_updated_at BEFORE UPDATE ON public.member_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
