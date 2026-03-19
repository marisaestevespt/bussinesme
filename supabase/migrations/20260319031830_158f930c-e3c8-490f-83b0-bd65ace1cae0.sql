
CREATE TABLE public.commercial_sales_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'por_comecar',
  action_name TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'outro',
  start_date DATE,
  end_date DATE,
  product TEXT,
  objective TEXT,
  result TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_sales_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales actions" ON public.commercial_sales_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales actions" ON public.commercial_sales_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sales actions" ON public.commercial_sales_actions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete sales actions" ON public.commercial_sales_actions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
