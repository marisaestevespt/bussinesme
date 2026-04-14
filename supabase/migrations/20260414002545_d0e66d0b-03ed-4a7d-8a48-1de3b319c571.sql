
CREATE TABLE public.publico_alvo_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  nav_group TEXT NOT NULL DEFAULT 'Geral',
  sort_order INTEGER NOT NULL DEFAULT 0,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.publico_alvo_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view publico_alvo_sections"
  ON public.publico_alvo_sections FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert publico_alvo_sections"
  ON public.publico_alvo_sections FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update publico_alvo_sections"
  ON public.publico_alvo_sections FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete publico_alvo_sections"
  ON public.publico_alvo_sections FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_publico_alvo_sections_updated_at
  BEFORE UPDATE ON public.publico_alvo_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
