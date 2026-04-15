
CREATE TABLE public.crm_custom_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_custom_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read crm_custom_stages"
  ON public.crm_custom_stages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage crm_custom_stages"
  ON public.crm_custom_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Seed with default stages
INSERT INTO public.crm_custom_stages (value, label, sort_order, is_default) VALUES
  ('lead', 'Lead', 0, true),
  ('primeiro_contacto', 'Primeiro Contacto', 1, true),
  ('sessao_agendada', 'Sessão Agendada', 2, true),
  ('proposta_enviada', 'Proposta Enviada', 3, true),
  ('follow_up_1', 'Follow Up 1', 4, true),
  ('follow_up_2', 'Follow Up 2', 5, true),
  ('follow_up_3', 'Follow Up 3', 6, true),
  ('aguarda_retorno', 'Aguarda Retorno', 7, true),
  ('outra_altura', 'Outra Altura', 8, true),
  ('ganho', 'Ganho', 9, true),
  ('perdido', 'Perdido', 10, true);
