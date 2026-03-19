
-- CRM Leads table
CREATE TABLE public.crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'outro',
  status TEXT NOT NULL DEFAULT 'lead',
  potential_product TEXT,
  closed_product TEXT,
  next_followup DATE,
  followup_notes TEXT,
  estimated_value NUMERIC DEFAULT 0,
  documents TEXT,
  context TEXT,
  lost_reason TEXT,
  added_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view crm leads" ON public.crm_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert crm leads" ON public.crm_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update crm leads" ON public.crm_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete crm leads" ON public.crm_leads FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- CRM Interactions table
CREATE TABLE public.crm_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  interaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  interaction_type TEXT NOT NULL DEFAULT 'outro',
  notes TEXT,
  files TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view crm interactions" ON public.crm_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert crm interactions" ON public.crm_interactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update crm interactions" ON public.crm_interactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete crm interactions" ON public.crm_interactions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- CRM Lead Actions (checklist)
CREATE TABLE public.crm_lead_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_lead_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view crm lead actions" ON public.crm_lead_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert crm lead actions" ON public.crm_lead_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update crm lead actions" ON public.crm_lead_actions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete crm lead actions" ON public.crm_lead_actions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
