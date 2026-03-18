
-- 1. Create event_types table
CREATE TABLE public.event_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view event types" ON public.event_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can insert event types" ON public.event_types
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can update event types" ON public.event_types
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete event types" ON public.event_types
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- 2. Seed with existing types
INSERT INTO public.event_types (name, color, slug) VALUES
  ('Lançamento', '#6366f1', 'lancamento'),
  ('Férias', '#10b981', 'ferias'),
  ('Campanha de Vendas', '#f59e0b', 'campanha_vendas'),
  ('Data Especial', '#8b5cf6', 'data_especial'),
  ('Abertura de Vagas', '#06b6d4', 'abertura_vagas'),
  ('Formação/Evento Externo', '#ec4899', 'formacao_evento'),
  ('Reunião Importante', '#ef4444', 'reuniao_importante'),
  ('Deadline', '#f97316', 'deadline'),
  ('Parceria/Colaboração', '#14b8a6', 'parceria_colaboracao');

-- 3. Add event_type_id column to events, populate it, then drop the old enum column
ALTER TABLE public.events ADD COLUMN event_type_id UUID REFERENCES public.event_types(id) ON DELETE SET NULL;

UPDATE public.events SET event_type_id = et.id
FROM public.event_types et WHERE et.slug = public.events.event_type::text;

ALTER TABLE public.events DROP COLUMN event_type;

-- 4. Drop the old enum type
DROP TYPE public.event_type;
