
-- KPI settings table
CREATE TABLE public.kpi_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  business_id UUID NOT NULL REFERENCES public.business_settings(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  kpi_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (business_id, area, kpi_key)
);

-- Enable RLS
ALTER TABLE public.kpi_settings ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read and manage
CREATE POLICY "Authenticated users can view kpi_settings"
  ON public.kpi_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert kpi_settings"
  ON public.kpi_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update kpi_settings"
  ON public.kpi_settings FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete kpi_settings"
  ON public.kpi_settings FOR DELETE TO authenticated USING (true);
