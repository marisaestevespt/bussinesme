
CREATE TABLE public.marketing_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'em_desenho',
  oferta_final text,
  objetivo text,
  plataforma text,
  notas text,
  gatilho text,
  plataformas_envolvidas jsonb DEFAULT '[]'::jsonb,
  fluxo jsonb DEFAULT '[]'::jsonb,
  condicoes jsonb DEFAULT '[]'::jsonb,
  links jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketing_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view automations" ON public.marketing_automations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert automations" ON public.marketing_automations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update automations" ON public.marketing_automations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete automations" ON public.marketing_automations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_marketing_automations_updated_at
  BEFORE UPDATE ON public.marketing_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
