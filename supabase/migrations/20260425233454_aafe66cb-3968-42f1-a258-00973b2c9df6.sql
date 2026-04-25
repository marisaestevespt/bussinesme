-- ============================================
-- FASE 1A: 6 CORREÇÕES CRÍTICAS DE SEGURANÇA
-- ============================================

-- 1. COMMERCIAL_SALES: remover SELECT e UPDATE abertos
DROP POLICY IF EXISTS "Authenticated can view sales" ON public.commercial_sales;
DROP POLICY IF EXISTS "Authenticated can update sales" ON public.commercial_sales;

CREATE POLICY "sales_update_role_based"
ON public.commercial_sales
FOR UPDATE
TO authenticated
USING (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('financeiro'::text)
  OR user_in_department('comercial'::text)
  OR (has_role(auth.uid(), 'sales'::app_role) AND (assigned_to = auth.uid() OR created_by = auth.uid()))
)
WITH CHECK (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('financeiro'::text)
  OR user_in_department('comercial'::text)
  OR (has_role(auth.uid(), 'sales'::app_role) AND (assigned_to = auth.uid() OR created_by = auth.uid()))
);

-- 2. FINANCIAL_DOCUMENTS: remover SELECT e UPDATE abertos
DROP POLICY IF EXISTS "Authenticated can view fin documents" ON public.financial_documents;
DROP POLICY IF EXISTS "Authenticated can update fin documents" ON public.financial_documents;

CREATE POLICY "fd_update_role_based"
ON public.financial_documents
FOR UPDATE
TO authenticated
USING (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR (has_role(auth.uid(), 'accountant'::app_role) AND accountant_access_enabled())
  OR user_in_department('financeiro'::text)
)
WITH CHECK (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR (has_role(auth.uid(), 'accountant'::app_role) AND accountant_access_enabled())
  OR user_in_department('financeiro'::text)
);

-- 3. FINANCIAL_CONTRACTORS: remover SELECT e UPDATE abertos
DROP POLICY IF EXISTS "Authenticated can view contractors" ON public.financial_contractors;
DROP POLICY IF EXISTS "Authenticated can update contractors" ON public.financial_contractors;

CREATE POLICY "fc_update_role_based"
ON public.financial_contractors
FOR UPDATE
TO authenticated
USING (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR (has_role(auth.uid(), 'accountant'::app_role) AND accountant_access_enabled())
  OR user_in_department('financeiro'::text)
)
WITH CHECK (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR (has_role(auth.uid(), 'accountant'::app_role) AND accountant_access_enabled())
  OR user_in_department('financeiro'::text)
);

-- 4. CLIENTS: substituir UPDATE aberto por role-based (igual ao SELECT)
DROP POLICY IF EXISTS "Authenticated can update clients" ON public.clients;

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
  OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(id))
  OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(id))
)
WITH CHECK (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR user_in_department('clientes'::text)
  OR (has_role(auth.uid(), 'sales'::app_role) AND user_can_access_client(id))
  OR (has_role(auth.uid(), 'team_member'::app_role) AND user_can_access_client(id))
);

-- 5. CRM_LEADS: substituir UPDATE aberto por role-based
DROP POLICY IF EXISTS "Authenticated can update crm leads" ON public.crm_leads;

CREATE POLICY "crm_leads_update_role_based"
ON public.crm_leads
FOR UPDATE
TO authenticated
USING (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR (has_role(auth.uid(), 'sales'::app_role) AND (responsible_id = auth.uid() OR created_by = auth.uid()))
)
WITH CHECK (
  is_owner() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'admin_staff'::app_role)
  OR user_in_department('comercial'::text)
  OR (has_role(auth.uid(), 'sales'::app_role) AND (responsible_id = auth.uid() OR created_by = auth.uid()))
);

-- 6. TEAM_MEMBERS: bloquear self-update de campos sensíveis
-- Já existe trigger protect_team_members_sensitive_fields, mas reforçar política
-- Trigger já bloqueia: custom_role_id, department, departments, access_suspended,
-- access_revoked, status, hourly_cost, settlement_*, role_title, work_areas,
-- profile_id, email, inactivated_at
-- Esta migração apenas confirma que o trigger existe (já criado anteriormente).
-- Garantir que está ativo:
DROP TRIGGER IF EXISTS trg_protect_team_members_sensitive_fields ON public.team_members;
CREATE TRIGGER trg_protect_team_members_sensitive_fields
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_team_members_sensitive_fields();