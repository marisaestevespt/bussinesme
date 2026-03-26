
-- Add default_vat_rate and documents to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS default_vat_rate integer DEFAULT 23;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;

-- Create SOP offboarding templates (mirrors onboarding template system)
CREATE TABLE IF NOT EXISTS public.sop_offboarding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_title text NOT NULL DEFAULT 'Geral',
  department text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_title, department)
);

CREATE TABLE IF NOT EXISTS public.sop_offboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.sop_offboarding_templates(id) ON DELETE CASCADE,
  task text NOT NULL DEFAULT '',
  deadline_days integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for templates
ALTER TABLE public.sop_offboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_offboarding_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage offboarding templates" ON public.sop_offboarding_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage offboarding items" ON public.sop_offboarding_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
