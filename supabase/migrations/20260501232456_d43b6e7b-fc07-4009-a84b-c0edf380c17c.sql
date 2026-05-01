-- L11: client_portals — substituir policy aberta por padrão consistente
DROP POLICY IF EXISTS "Authenticated users can manage portals" ON public.client_portals;

CREATE POLICY "client_portals_select" ON public.client_portals
FOR SELECT TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(client_id))
  OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(client_id))
);

CREATE POLICY "client_portals_insert" ON public.client_portals
FOR INSERT TO authenticated
WITH CHECK (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
);

CREATE POLICY "client_portals_update" ON public.client_portals
FOR UPDATE TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
);

CREATE POLICY "client_portals_delete" ON public.client_portals
FOR DELETE TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
);

-- L11: google_calendars — restringir SELECT (esconde sync_token)
DROP POLICY IF EXISTS "Authenticated can view calendars" ON public.google_calendars;

CREATE POLICY "Only admins/owners can view calendars" ON public.google_calendars
FOR SELECT TO authenticated
USING (is_admin_or_owner());