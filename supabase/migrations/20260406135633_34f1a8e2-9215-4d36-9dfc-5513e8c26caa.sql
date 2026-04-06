
-- Product phases (template)
CREATE TABLE public.product_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  linked_sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view product_phases" ON public.product_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert product_phases" ON public.product_phases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update product_phases" ON public.product_phases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete product_phases" ON public.product_phases FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

-- Project phases (instance)
CREATE TABLE public.project_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  started_at timestamptz,
  completed_at timestamptz,
  linked_sop_id uuid REFERENCES public.sops(id) ON DELETE SET NULL,
  source_phase_id uuid REFERENCES public.product_phases(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view project_phases" ON public.project_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert project_phases" ON public.project_phases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update project_phases" ON public.project_phases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete project_phases" ON public.project_phases FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_project_phases_updated_at BEFORE UPDATE ON public.project_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add phase_id to deliverable templates
ALTER TABLE public.product_deliverable_templates ADD COLUMN phase_id uuid REFERENCES public.product_phases(id) ON DELETE SET NULL;

-- Add phase_id to project deliverables
ALTER TABLE public.project_deliverables ADD COLUMN phase_id uuid REFERENCES public.project_phases(id) ON DELETE SET NULL;

-- Portal RPC for phases
CREATE OR REPLACE FUNCTION public.get_portal_phases(_token uuid)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  sort_order integer,
  status text,
  started_at timestamptz,
  completed_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pp.id, pp.name, pp.description, pp.sort_order, pp.status, pp.started_at, pp.completed_at
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.projects p ON p.client_id = c.id
  JOIN public.project_phases pp ON pp.project_id = p.id
  WHERE cp.token = _token
    AND cp.is_active = true
  ORDER BY pp.sort_order ASC;
$$;
