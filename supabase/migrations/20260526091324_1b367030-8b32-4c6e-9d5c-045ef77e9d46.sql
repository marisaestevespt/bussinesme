-- ============================================================
-- Fix #1 — Align client-related tables with clients access gate
-- ============================================================

-- client_onboarding
DROP POLICY IF EXISTS "Authenticated can view client_onboarding" ON public.client_onboarding;
DROP POLICY IF EXISTS "Authenticated can insert client_onboarding" ON public.client_onboarding;
DROP POLICY IF EXISTS "Authenticated can update client_onboarding" ON public.client_onboarding;

CREATE POLICY "client_onboarding_select_scoped"
ON public.client_onboarding FOR SELECT TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (client_id IS NOT NULL AND user_can_access_client(client_id))
);

CREATE POLICY "client_onboarding_insert_scoped"
ON public.client_onboarding FOR INSERT TO authenticated
WITH CHECK (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
);

CREATE POLICY "client_onboarding_update_scoped"
ON public.client_onboarding FOR UPDATE TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (client_id IS NOT NULL AND user_can_access_client(client_id))
);

-- client_offboarding
DROP POLICY IF EXISTS "Authenticated users can view client offboarding" ON public.client_offboarding;
DROP POLICY IF EXISTS "Authenticated users can insert client offboarding" ON public.client_offboarding;
DROP POLICY IF EXISTS "Authenticated users can update client offboarding" ON public.client_offboarding;
DROP POLICY IF EXISTS "Authenticated users can delete client offboarding" ON public.client_offboarding;

CREATE POLICY "client_offboarding_select_scoped"
ON public.client_offboarding FOR SELECT TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (client_id IS NOT NULL AND user_can_access_client(client_id))
);

CREATE POLICY "client_offboarding_insert_scoped"
ON public.client_offboarding FOR INSERT TO authenticated
WITH CHECK (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
);

CREATE POLICY "client_offboarding_update_scoped"
ON public.client_offboarding FOR UPDATE TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (client_id IS NOT NULL AND user_can_access_client(client_id))
);

CREATE POLICY "client_offboarding_delete_owner_admin"
ON public.client_offboarding FOR DELETE TO authenticated
USING (is_owner() OR has_role(auth.uid(), 'admin'::app_role));

-- client_activities
DROP POLICY IF EXISTS "Authenticated can view client_activities" ON public.client_activities;
DROP POLICY IF EXISTS "Authenticated can insert client_activities" ON public.client_activities;
DROP POLICY IF EXISTS "Authenticated can update client_activities" ON public.client_activities;

CREATE POLICY "client_activities_select_scoped"
ON public.client_activities FOR SELECT TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (client_id IS NOT NULL AND user_can_access_client(client_id))
);

CREATE POLICY "client_activities_insert_scoped"
ON public.client_activities FOR INSERT TO authenticated
WITH CHECK (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
);

CREATE POLICY "client_activities_update_scoped"
ON public.client_activities FOR UPDATE TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR (client_id IS NOT NULL AND user_can_access_client(client_id))
);

-- client_requests (keep ALL for team-managed + add scoped select)
DROP POLICY IF EXISTS "Authenticated can view client requests" ON public.client_requests;

CREATE POLICY "client_requests_select_scoped"
ON public.client_requests FOR SELECT TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
  OR is_active_team_member()
);

-- clients_monthly_analysis
DROP POLICY IF EXISTS "Authenticated users can view client analysis" ON public.clients_monthly_analysis;
DROP POLICY IF EXISTS "Authenticated users can insert client analysis" ON public.clients_monthly_analysis;
DROP POLICY IF EXISTS "Authenticated users can update client analysis" ON public.clients_monthly_analysis;

CREATE POLICY "clients_monthly_analysis_select_scoped"
ON public.clients_monthly_analysis FOR SELECT TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
);

CREATE POLICY "clients_monthly_analysis_insert_scoped"
ON public.clients_monthly_analysis FOR INSERT TO authenticated
WITH CHECK (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
);

CREATE POLICY "clients_monthly_analysis_update_scoped"
ON public.clients_monthly_analysis FOR UPDATE TO authenticated
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR user_in_department('operacao'::text)
);

-- ============================================================
-- Fix #2 — Restrict role_permissions SELECT to owners
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view role permissions" ON public.role_permissions;

CREATE POLICY "Owners can view role permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Fix #3 — Drop duplicate business_settings SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Anyone authenticated can read business settings" ON public.business_settings;
-- "Authenticated can read business settings" remains as the single SELECT policy