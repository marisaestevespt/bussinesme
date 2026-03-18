
-- SOPs table
CREATE TABLE public.sops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id text NOT NULL DEFAULT 'SOP-1',
  name text NOT NULL,
  status text NOT NULL DEFAULT 'para_criar',
  department text NOT NULL DEFAULT 'administrativo',
  custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL,
  product_name text,
  objetivo text,
  utilizacao_usado jsonb DEFAULT '[]'::jsonb,
  utilizacao_nao_usado jsonb DEFAULT '[]'::jsonb,
  inputs jsonb DEFAULT '[]'::jsonb,
  passos jsonb DEFAULT '["","","","","",""]'::jsonb,
  decisoes jsonb DEFAULT '[]'::jsonb,
  outputs jsonb DEFAULT '[]'::jsonb,
  notas jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sops" ON public.sops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sops" ON public.sops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sops" ON public.sops FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete sops" ON public.sops FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_sops_updated_at BEFORE UPDATE ON public.sops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Routines table
CREATE TABLE public.routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'todos_os_dias',
  department text NOT NULL DEFAULT 'administrativo',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view routines" ON public.routines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert routines" ON public.routines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update routines" ON public.routines FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete routines" ON public.routines FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence function for SOP IDs
CREATE OR REPLACE FUNCTION public.generate_sop_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN sop_id ~ '^SOP-[0-9]+$' 
    THEN CAST(SUBSTRING(sop_id FROM 5) AS integer) 
    ELSE 0 END
  ), 0) + 1 INTO next_num FROM public.sops;
  
  IF NEW.sop_id = 'SOP-1' OR NEW.sop_id IS NULL THEN
    NEW.sop_id := 'SOP-' || next_num;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_sop_id_trigger BEFORE INSERT ON public.sops
  FOR EACH ROW EXECUTE FUNCTION public.generate_sop_id();
