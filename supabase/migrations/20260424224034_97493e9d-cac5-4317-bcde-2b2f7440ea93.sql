-- 1. Criar novos tipos: feriado e off
INSERT INTO public.event_types (name, slug, color) VALUES
  ('Feriado', 'feriado', '#94a3b8'),
  ('Off (Negócio Fechado)', 'off', '#dc2626')
ON CONFLICT (slug) DO NOTHING;

-- 2. Renomear "Feedback" para "Feedback Equipa"
UPDATE public.event_types SET name = 'Feedback Equipa' WHERE slug = 'feedback';

-- 3. Migrar eventos antigos para novos tipos
-- Lançamento → Campanha de Vendas
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE slug = 'campanha_vendas')
WHERE event_type_id = (SELECT id FROM public.event_types WHERE slug = 'lancamento');

-- Férias → Off
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE slug = 'off')
WHERE event_type_id = (SELECT id FROM public.event_types WHERE slug = 'ferias');

-- Reunião Importante, Reunião Interna, Deadline, Parceria → null (mantém título, sem tipo)
UPDATE public.events SET event_type_id = NULL
WHERE event_type_id IN (
  SELECT id FROM public.event_types
  WHERE slug IN ('reuniao_importante', 'reuniao_interna', 'deadline', 'parceria_colaboracao')
);

-- 4. Apagar tipos descontinuados
DELETE FROM public.event_types
WHERE slug IN ('lancamento', 'ferias', 'reuniao_importante', 'reuniao_interna', 'deadline', 'parceria_colaboracao');