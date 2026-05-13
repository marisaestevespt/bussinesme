ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE public.clients
ADD CONSTRAINT clients_status_check
CHECK (status IN ('em_onboarding', 'ativo', 'pausado', 'altura_renovacao', 'em_offboarding', 'terminado', 'suspenso'));