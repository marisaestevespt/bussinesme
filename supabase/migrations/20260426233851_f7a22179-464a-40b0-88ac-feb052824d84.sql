-- ============================================
-- Adicionar 'operacao' às policies de clients e projects
-- ============================================

-- CLIENTS: SELECT
DROP POLICY IF EXISTS "clients_select_role_based" ON public.clients;
CREATE POLICY "clients_select_role_based" ON public.clients FOR SELECT USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('comercial')
  OR public.user_in_department('clientes')
  OR public.user_in_department('operacao')
  OR (public.has_role(auth.uid(),'sales') AND public.user_can_access_client(id))
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_client(id))
);

-- CLIENTS: UPDATE
DROP POLICY IF EXISTS "clients_update_role_based" ON public.clients;
CREATE POLICY "clients_update_role_based"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(id))
  OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(id))
)
WITH CHECK (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(id))
  OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(id))
);

-- CLIENT_CONTACTS: SELECT
DROP POLICY IF EXISTS "cc_select" ON public.client_contacts;
CREATE POLICY "cc_select" ON public.client_contacts FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('clientes')
  OR public.user_in_department('operacao')
  OR (public.has_role(auth.uid(),'sales')       AND public.user_can_access_client(client_id))
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_client(client_id))
);

-- PROJECTS: SELECT (substituir policy aberta antiga + role-based se existir)
DROP POLICY IF EXISTS "Authenticated can view projects" ON public.projects;
DROP POLICY IF EXISTS "projects_select_role_based" ON public.projects;
CREATE POLICY "projects_select_role_based" ON public.projects FOR SELECT
TO authenticated
USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('comercial')
  OR public.user_in_department('clientes')
  OR public.user_in_department('operacao')
  OR (public.has_role(auth.uid(),'sales')       AND public.user_can_access_client(client_id))
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_project(id))
);

-- PROJECTS: UPDATE
DROP POLICY IF EXISTS "Authenticated can update projects" ON public.projects;
DROP POLICY IF EXISTS "projects_update_role_based" ON public.projects;
CREATE POLICY "projects_update_role_based" ON public.projects FOR UPDATE
TO authenticated
USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('comercial')
  OR public.user_in_department('clientes')
  OR public.user_in_department('operacao')
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_project(id))
)
WITH CHECK (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('comercial')
  OR public.user_in_department('clientes')
  OR public.user_in_department('operacao')
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_project(id))
);