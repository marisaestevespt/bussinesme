
CREATE TABLE IF NOT EXISTS public.year_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise','fechado')),
  fechado_em TIMESTAMPTZ,
  o_que_funcionou TEXT,
  o_que_mudar TEXT,
  decisoes_ano_seguinte TEXT,
  alinhamento_visao_5_anos TEXT,
  area_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

ALTER TABLE public.year_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own year reviews"
  ON public.year_review FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_year_review_updated_at
  BEFORE UPDATE ON public.year_review
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
