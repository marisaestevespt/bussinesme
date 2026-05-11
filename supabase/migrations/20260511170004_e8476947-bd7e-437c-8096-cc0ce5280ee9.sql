
-- Ritual banner state tracking
CREATE TABLE IF NOT EXISTS public.ritual_banner_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  ritual_type TEXT NOT NULL CHECK (ritual_type IN (
    'fecho_ano','fecho_mes','planear_mes','inicio_semestre','inicio_trimestre','weekly_align','vespera_weekly'
  )),
  periodo TEXT NOT NULL,
  dispensado_em TIMESTAMPTZ,
  completado BOOLEAN NOT NULL DEFAULT false,
  completado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ritual_type, periodo)
);

ALTER TABLE public.ritual_banner_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own ritual state"
  ON public.ritual_banner_state FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_ritual_banner_state_updated_at
  BEFORE UPDATE ON public.ritual_banner_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ritual_banner_state_user ON public.ritual_banner_state (user_id, ritual_type, periodo);
