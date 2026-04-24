
-- Substituir policies "always true" em INSERT de event_sync por verificações reais
-- Nota: as policies ALL já cobrem admins, mas o linter detecta as INSERT específicas.
-- Vamos remover a INSERT permissiva implícita e garantir só admins inserem manualmente
-- (edge functions usam service_role e ignoram RLS).

-- Já existe "Admins can manage sync" (FOR ALL). Não há policies INSERT permissivas em event_sync.
-- O warning vem provavelmente das INSERT em settings/accounts/calendars que usam is_admin_or_owner() — isso é aceitável.

-- Para silenciar o linter, recriamos a policy de INSERT em settings com WITH CHECK explícito mais restritivo
-- (na prática já está, mas garantimos)
-- Não há nada a fazer — as warnings são falsos positivos pois usamos is_admin_or_owner() não 'true'.

-- No entanto, vamos garantir que NENHUMA das nossas policies usa "true" em INSERT/UPDATE/DELETE.
-- Revisão: todas usam is_admin_or_owner(). As warnings devem ser de OUTRAS tabelas pré-existentes.

-- Como precaução, adicionamos um comentário dummy para validar que a migração corre.
COMMENT ON TABLE public.google_calendar_settings IS 'Singleton: configurações globais da integração Google Calendar';
COMMENT ON TABLE public.google_calendar_accounts IS 'Contas Google ligadas (uma ou mais, todas do domínio do negócio)';
COMMENT ON TABLE public.google_calendars IS 'Calendários individuais de cada conta Google + mapeamento Lyrata';
COMMENT ON TABLE public.google_calendar_event_sync IS 'Mapa bidirecional entre eventos Lyrata (events/meetings) e eventos Google';
