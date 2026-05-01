-- ============ L9: portal_project_history HARDENING ============

DROP POLICY IF EXISTS "Authenticated users can manage portal project history" ON public.portal_project_history;

CREATE POLICY "Authenticated can view portal_project_history"
  ON public.portal_project_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Operacao can insert portal_project_history"
  ON public.portal_project_history FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR public.user_in_department('operacao')
    OR public.user_in_department('clientes')
  );

CREATE POLICY "Operacao can update portal_project_history"
  ON public.portal_project_history FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR public.user_in_department('operacao')
    OR public.user_in_department('clientes')
  )
  WITH CHECK (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR public.user_in_department('operacao')
    OR public.user_in_department('clientes')
  );

CREATE POLICY "Operacao can delete portal_project_history"
  ON public.portal_project_history FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR public.user_in_department('operacao')
    OR public.user_in_department('clientes')
  );