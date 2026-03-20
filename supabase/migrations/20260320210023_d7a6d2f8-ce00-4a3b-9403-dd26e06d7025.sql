
-- Portal type enum
CREATE TYPE public.portal_type AS ENUM ('projeto_unico', 'servico_mensal');

-- Comment author enum
CREATE TYPE public.portal_comment_author AS ENUM ('client', 'team');

-- Client portals
CREATE TABLE public.client_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  portal_type portal_type NOT NULL,
  show_workspace BOOLEAN NOT NULL DEFAULT true,
  show_meetings BOOLEAN NOT NULL DEFAULT true,
  show_payments BOOLEAN NOT NULL DEFAULT true,
  show_faqs BOOLEAN NOT NULL DEFAULT true,
  show_onboarding BOOLEAN NOT NULL DEFAULT true,
  show_timeline BOOLEAN NOT NULL DEFAULT true,
  show_monthly_summary BOOLEAN NOT NULL DEFAULT true,
  last_visit_at TIMESTAMPTZ,
  UNIQUE (client_id),
  UNIQUE (token)
);

ALTER TABLE public.client_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage portals"
  ON public.client_portals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Portal FAQs
CREATE TABLE public.portal_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.portal_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage portal FAQs"
  ON public.portal_faqs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Portal FAQs publicly readable"
  ON public.portal_faqs FOR SELECT TO anon USING (true);

-- Portal initial questions
CREATE TABLE public.portal_initial_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  answered_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.portal_initial_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage portal questions"
  ON public.portal_initial_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Portal questions publicly readable and updatable"
  ON public.portal_initial_questions FOR SELECT TO anon USING (true);

CREATE POLICY "Portal questions publicly answerable"
  ON public.portal_initial_questions FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Portal feedback
CREATE TABLE public.portal_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage portal feedback"
  ON public.portal_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Portal feedback publicly insertable"
  ON public.portal_feedback FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Portal feedback publicly readable"
  ON public.portal_feedback FOR SELECT TO anon USING (true);

-- Portal comments
CREATE TABLE public.portal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author portal_comment_author NOT NULL,
  author_name TEXT NOT NULL
);

ALTER TABLE public.portal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage portal comments"
  ON public.portal_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Portal comments publicly readable"
  ON public.portal_comments FOR SELECT TO anon USING (true);

CREATE POLICY "Portal comments publicly insertable by client"
  ON public.portal_comments FOR INSERT TO anon WITH CHECK (true);

-- Portal OTP
CREATE TABLE public.portal_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  used BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.portal_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal OTP publicly insertable"
  ON public.portal_otp FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Portal OTP publicly readable"
  ON public.portal_otp FOR SELECT TO anon USING (true);

CREATE POLICY "Portal OTP publicly updatable"
  ON public.portal_otp FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage OTP"
  ON public.portal_otp FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Client portals readable by anon (for public portal access)
CREATE POLICY "Portal publicly readable by token"
  ON public.client_portals FOR SELECT TO anon USING (true);

CREATE POLICY "Portal last_visit updatable by anon"
  ON public.client_portals FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Add visible_in_portal to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS visible_in_portal BOOLEAN NOT NULL DEFAULT false;

-- Portal timeline phases (for projeto_unico)
CREATE TABLE public.portal_timeline_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'por_comecar',
  sort_order INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.portal_timeline_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage timeline phases"
  ON public.portal_timeline_phases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Timeline phases publicly readable"
  ON public.portal_timeline_phases FOR SELECT TO anon USING (true);

-- Portal monthly summaries (for servico_mensal)
CREATE TABLE public.portal_monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  portal_id UUID NOT NULL REFERENCES public.client_portals(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  content TEXT NOT NULL,
  UNIQUE (portal_id, month, year)
);

ALTER TABLE public.portal_monthly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage monthly summaries"
  ON public.portal_monthly_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Monthly summaries publicly readable"
  ON public.portal_monthly_summaries FOR SELECT TO anon USING (true);
