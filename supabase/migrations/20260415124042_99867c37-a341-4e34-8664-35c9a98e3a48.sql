
-- Global labels table
CREATE TABLE public.crm_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lead-label junction
CREATE TABLE public.crm_lead_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.crm_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, label_id)
);

-- Pipeline-label junction
CREATE TABLE public.crm_pipeline_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.crm_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id, label_id)
);

-- Enable RLS
ALTER TABLE public.crm_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_pipeline_labels ENABLE ROW LEVEL SECURITY;

-- Policies for crm_labels
CREATE POLICY "Authenticated users can view labels" ON public.crm_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create labels" ON public.crm_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update labels" ON public.crm_labels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete labels" ON public.crm_labels FOR DELETE TO authenticated USING (true);

-- Policies for crm_lead_labels
CREATE POLICY "Authenticated users can view lead labels" ON public.crm_lead_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create lead labels" ON public.crm_lead_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete lead labels" ON public.crm_lead_labels FOR DELETE TO authenticated USING (true);

-- Policies for crm_pipeline_labels
CREATE POLICY "Authenticated users can view pipeline labels" ON public.crm_pipeline_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create pipeline labels" ON public.crm_pipeline_labels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete pipeline labels" ON public.crm_pipeline_labels FOR DELETE TO authenticated USING (true);
