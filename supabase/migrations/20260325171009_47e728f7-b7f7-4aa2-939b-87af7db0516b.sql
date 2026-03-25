
-- Table for SOP onboarding checklist templates (linked by role_title)
CREATE TABLE public.sop_onboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_title text NOT NULL,
  sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_title)
);

-- Checklist items for each template, with relative deadlines in days
CREATE TABLE public.sop_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.sop_onboarding_templates(id) ON DELETE CASCADE NOT NULL,
  task text NOT NULL,
  deadline_days integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add deadline_date and source columns to member_onboarding
ALTER TABLE public.member_onboarding
  ADD COLUMN IF NOT EXISTS deadline_date date,
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.sop_onboarding_templates(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.sop_onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_onboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage onboarding templates"
  ON public.sop_onboarding_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage onboarding items"
  ON public.sop_onboarding_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
