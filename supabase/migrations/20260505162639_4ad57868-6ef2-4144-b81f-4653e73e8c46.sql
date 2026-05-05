CREATE TABLE IF NOT EXISTS public.brand_archetypes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slot TEXT NOT NULL UNIQUE CHECK (slot IN ('dominante', 'secundario', 'auxiliar')),
  archetype TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_archetypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brand archetypes" ON public.brand_archetypes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand archetypes" ON public.brand_archetypes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update brand archetypes" ON public.brand_archetypes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand archetypes" ON public.brand_archetypes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_brand_archetypes_updated_at
  BEFORE UPDATE ON public.brand_archetypes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.brand_archetypes (slot) VALUES ('dominante'), ('secundario'), ('auxiliar')
  ON CONFLICT (slot) DO NOTHING;