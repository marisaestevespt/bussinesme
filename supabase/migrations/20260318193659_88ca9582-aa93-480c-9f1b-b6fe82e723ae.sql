
-- Event type enum
CREATE TYPE public.event_type AS ENUM (
  'lancamento',
  'ferias',
  'campanha_vendas',
  'data_especial',
  'abertura_vagas',
  'formacao_evento',
  'reuniao_importante',
  'deadline',
  'parceria_colaboracao'
);

-- Events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_type public.event_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  product_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view events" ON public.events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Owners can update events" ON public.events
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete events" ON public.events
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

-- Updated at trigger
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
