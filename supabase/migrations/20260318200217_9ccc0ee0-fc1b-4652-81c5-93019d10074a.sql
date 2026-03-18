
CREATE TABLE public.platform_accesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_name TEXT NOT NULL,
  username_email TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  platform_type TEXT NOT NULL DEFAULT 'outros',
  direct_link TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_accesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view platform accesses" ON public.platform_accesses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert platform accesses" ON public.platform_accesses FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can update platform accesses" ON public.platform_accesses FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete platform accesses" ON public.platform_accesses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));
