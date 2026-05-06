
CREATE TABLE IF NOT EXISTS public.brand_universe_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_universe_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brand universe notes" ON public.brand_universe_notes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners can insert brand universe notes" ON public.brand_universe_notes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can update brand universe notes" ON public.brand_universe_notes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Owners can delete brand universe notes" ON public.brand_universe_notes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_brand_universe_notes_updated_at
  BEFORE UPDATE ON public.brand_universe_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
