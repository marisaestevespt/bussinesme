-- Product onboarding template items
CREATE TABLE public.product_onboarding_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  phase TEXT,
  activity TEXT NOT NULL DEFAULT '',
  responsible TEXT,
  rule TEXT,
  documents_links TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_onboarding_templates ENABLE ROW LEVEL SECURITY;

-- Policies (same pattern as other product tables)
CREATE POLICY "Anyone can view product onboarding templates"
  ON public.product_onboarding_templates FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert product onboarding templates"
  ON public.product_onboarding_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update product onboarding templates"
  ON public.product_onboarding_templates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete product onboarding templates"
  ON public.product_onboarding_templates FOR DELETE TO authenticated USING (true);

-- Also add documents_links column to client_onboarding for per-client docs/links
ALTER TABLE public.client_onboarding ADD COLUMN IF NOT EXISTS documents_links TEXT;