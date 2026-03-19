
CREATE TABLE public.marketing_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'em_ideia',
  entry_points jsonb DEFAULT '[]'::jsonb,
  oferta_final text,
  objetivo text,
  plataformas jsonb DEFAULT '[]'::jsonb,
  tipo_funil text,
  notas text,
  etapas jsonb DEFAULT '[{"nome":"","descricao":"","condicao":""},{"nome":"","descricao":"","condicao":""},{"nome":"","descricao":"","condicao":""},{"nome":"","descricao":"","condicao":""},{"nome":"","descricao":"","condicao":""},{"nome":"","descricao":"","condicao":""}]'::jsonb,
  fluxo_resumido text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view funnels" ON public.marketing_funnels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert funnels" ON public.marketing_funnels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update funnels" ON public.marketing_funnels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete funnels" ON public.marketing_funnels FOR DELETE TO authenticated USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_marketing_funnels_updated_at BEFORE UPDATE ON public.marketing_funnels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
