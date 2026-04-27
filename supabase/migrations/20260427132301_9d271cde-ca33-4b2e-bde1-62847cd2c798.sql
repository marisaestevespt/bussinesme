-- Substituir índice errado por um que permite várias atividades por ciclo
DROP INDEX IF EXISTS public.uniq_client_renewal_per_cycle;
CREATE UNIQUE INDEX uniq_client_renewal_per_cycle_order
  ON public.client_renewals (client_id, cycle_number, sort_order);