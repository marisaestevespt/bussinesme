
-- L3 — Apertar RLS de client_history + CHECK + trigger updated_at em clients

-- ─── client_history RLS ──────────────────────────────────
DROP POLICY IF EXISTS "Authenticated can view client_history" ON public.client_history;
DROP POLICY IF EXISTS "Authenticated can insert client_history" ON public.client_history;
DROP POLICY IF EXISTS "Authenticated can update client_history" ON public.client_history;

CREATE POLICY "client_history_select_role_based"
  ON public.client_history FOR SELECT TO authenticated
  USING (
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_staff'::app_role)
    OR user_in_department('comercial')
    OR user_in_department('clientes')
    OR user_in_department('operacao')
    OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(client_id))
    OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(client_id))
  );

CREATE POLICY "client_history_insert_role_based"
  ON public.client_history FOR INSERT TO authenticated
  WITH CHECK (
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_staff'::app_role)
    OR user_in_department('comercial')
    OR user_in_department('clientes')
    OR user_in_department('operacao')
    OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(client_id))
    OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(client_id))
  );

CREATE POLICY "client_history_update_role_based"
  ON public.client_history FOR UPDATE TO authenticated
  USING (
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_staff'::app_role)
    OR user_in_department('comercial')
    OR user_in_department('clientes')
    OR user_in_department('operacao')
    OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(client_id))
    OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(client_id))
  )
  WITH CHECK (
    is_owner()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_staff'::app_role)
    OR user_in_department('comercial')
    OR user_in_department('clientes')
    OR user_in_department('operacao')
    OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(client_id))
    OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(client_id))
  );

-- ─── CHECK clients.status ────────────────────────────────
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_status_check
  CHECK (status IN ('ativo','terminado','suspenso'));

-- ─── Trigger updated_at em clients ───────────────────────
DROP TRIGGER IF EXISTS clients_set_updated_at ON public.clients;
CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
