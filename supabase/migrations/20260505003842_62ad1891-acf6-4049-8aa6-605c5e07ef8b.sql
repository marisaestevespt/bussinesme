
DROP POLICY IF EXISTS commercial_sales_insert_scoped ON public.commercial_sales;
CREATE POLICY commercial_sales_insert_scoped ON public.commercial_sales
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR current_user_has_sensitive_access('financial_values'::text)
  OR EXISTS (
    SELECT 1 FROM team_members tm
    JOIN profiles p ON p.id = tm.profile_id
    JOIN role_permissions rp ON rp.custom_role_id = tm.custom_role_id
    WHERE p.user_id = auth.uid()
      AND rp.module_key = ANY (ARRAY['comercial','financeiro','administrativo'])
      AND rp.can_view = true
  )
);

DROP POLICY IF EXISTS clients_insert_scoped ON public.clients;
CREATE POLICY clients_insert_scoped ON public.clients
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR current_user_has_sensitive_access('clients'::text)
  OR EXISTS (
    SELECT 1 FROM team_members tm
    JOIN profiles p ON p.id = tm.profile_id
    JOIN role_permissions rp ON rp.custom_role_id = tm.custom_role_id
    WHERE p.user_id = auth.uid()
      AND rp.module_key = ANY (ARRAY['clientes','comercial','administrativo'])
      AND rp.can_view = true
  )
);
