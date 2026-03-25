CREATE TABLE public.hiring_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Simulação sem nome',
  phantoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hiring_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage simulations"
  ON public.hiring_simulations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_hiring_simulations_updated_at
  BEFORE UPDATE ON public.hiring_simulations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();