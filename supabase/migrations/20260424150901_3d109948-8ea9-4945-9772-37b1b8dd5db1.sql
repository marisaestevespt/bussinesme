
-- ============================================================
-- PACOTE SEGURANÇA P0 — Parte 2 (helpers, schema, RLS, lockdown)
-- ============================================================

-- A.2 Helpers SECURITY DEFINER ===========================================
CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT public.has_role(auth.uid(), 'owner') $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_roles public.app_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role = ANY(_roles)) $$;

CREATE OR REPLACE FUNCTION public.current_team_member_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT tm.id FROM public.team_members tm
  JOIN public.profiles p ON p.id = tm.profile_id
  WHERE p.user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_departments() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    NULLIF(ARRAY(SELECT jsonb_array_elements_text(tm.departments)), ARRAY[]::text[]),
    CASE WHEN tm.department IS NOT NULL THEN ARRAY[tm.department] ELSE ARRAY[]::text[] END
  )
  FROM public.team_members tm
  JOIN public.profiles p ON p.id = tm.profile_id
  WHERE p.user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_in_department(_dept text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS
$$ SELECT _dept = ANY(public.current_user_departments()) $$;

-- C.1 Schema novo ==================================================
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_suspended_by uuid REFERENCES auth.users(id);

ALTER TABLE public.commercial_sales
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.role_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id),
  actor_name text,
  action text NOT NULL CHECK (action IN (
    'role_granted','role_revoked','access_suspended','access_resumed',
    'sensitive_access_granted','sensitive_access_revoked',
    'client_assigned','client_unassigned'
  )),
  target_user_id uuid,
  target_member_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.role_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_log_owner_read" ON public.role_activity_log;
DROP POLICY IF EXISTS "role_log_system_write" ON public.role_activity_log;
CREATE POLICY "role_log_owner_read" ON public.role_activity_log FOR SELECT USING (public.is_owner());
CREATE POLICY "role_log_system_write" ON public.role_activity_log FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'general' CHECK (assignment_type IN ('general','sales','admin','support')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (client_id, profile_id, assignment_type)
);
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ca_read_self_or_admin" ON public.client_assignments;
DROP POLICY IF EXISTS "ca_write_owner_admin" ON public.client_assignments;
CREATE POLICY "ca_read_self_or_admin" ON public.client_assignments FOR SELECT
  USING (public.is_admin_or_owner() OR profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  ));
CREATE POLICY "ca_write_owner_admin" ON public.client_assignments FOR ALL
  USING (public.is_admin_or_owner()) WITH CHECK (public.is_admin_or_owner());
CREATE INDEX IF NOT EXISTS idx_ca_profile ON public.client_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_ca_client ON public.client_assignments(client_id);

CREATE OR REPLACE FUNCTION public.user_can_access_client(_client_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    public.is_admin_or_owner()
    OR EXISTS (
      SELECT 1 FROM public.projects pr
      JOIN public.project_members pm ON pm.project_id = pr.id
      JOIN public.profiles p ON p.id = pm.profile_id
      WHERE pr.client_id = _client_id AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.client_assignments ca
      JOIN public.profiles p ON p.id = ca.profile_id
      WHERE ca.client_id = _client_id AND p.user_id = auth.uid()
    )
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_project(_project_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin_or_owner()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      JOIN public.profiles p ON p.id = pm.profile_id
      WHERE pm.project_id = _project_id AND p.user_id = auth.uid()
    )
$$;

CREATE OR REPLACE FUNCTION public.accountant_access_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.profile_id
    WHERE p.user_id = auth.uid() AND tm.access_suspended = true
  )
$$;

-- C.2 Triggers de audit ==========================================
CREATE OR REPLACE FUNCTION public.log_role_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _name text;
BEGIN
  SELECT full_name INTO _name FROM public.profiles WHERE user_id = auth.uid();
  IF TG_OP='INSERT' THEN
    INSERT INTO public.role_activity_log (actor_user_id, actor_name, action, target_user_id, metadata)
    VALUES (auth.uid(), _name, 'role_granted', NEW.user_id, jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    INSERT INTO public.role_activity_log (actor_user_id, actor_name, action, target_user_id, metadata)
    VALUES (auth.uid(), _name, 'role_revoked', OLD.user_id, jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_log_user_roles ON public.user_roles;
CREATE TRIGGER trg_log_user_roles
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

CREATE OR REPLACE FUNCTION public.log_access_suspension() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _name text; _user uuid;
BEGIN
  IF NEW.access_suspended IS DISTINCT FROM OLD.access_suspended THEN
    SELECT full_name INTO _name FROM public.profiles WHERE user_id = auth.uid();
    SELECT user_id INTO _user FROM public.profiles WHERE id = NEW.profile_id;
    INSERT INTO public.role_activity_log (actor_user_id, actor_name, action, target_user_id, target_member_id, metadata)
    VALUES (auth.uid(), _name,
      CASE WHEN NEW.access_suspended THEN 'access_suspended' ELSE 'access_resumed' END,
      _user, NEW.id, jsonb_build_object('member_name', NEW.full_name));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_access_suspension ON public.team_members;
CREATE TRIGGER trg_log_access_suspension
AFTER UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.log_access_suspension();

-- D — RLS hardening em 13 tabelas =====================================

-- D.1 clients
DROP POLICY IF EXISTS "Authenticated can read clients" ON public.clients;
DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "clients_select_authenticated" ON public.clients;
DROP POLICY IF EXISTS "clients_select_role_based" ON public.clients;
CREATE POLICY "clients_select_role_based" ON public.clients FOR SELECT USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('comercial')
  OR public.user_in_department('clientes')
  OR (public.has_role(auth.uid(),'sales') AND public.user_can_access_client(id))
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_client(id))
);

-- D.2 client_contacts
DROP POLICY IF EXISTS "Authenticated can read client_contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "client_contacts_select" ON public.client_contacts;
DROP POLICY IF EXISTS "Authenticated users can view client_contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "cc_select" ON public.client_contacts;
CREATE POLICY "cc_select" ON public.client_contacts FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('clientes')
  OR (public.has_role(auth.uid(),'sales')       AND public.user_can_access_client(client_id))
  OR (public.has_role(auth.uid(),'team_member') AND public.user_can_access_client(client_id))
);

-- D.3 team_members
DROP POLICY IF EXISTS "Authenticated can read team_members" ON public.team_members;
DROP POLICY IF EXISTS "team_members_select" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated users can view team_members" ON public.team_members;
DROP POLICY IF EXISTS "tm_select" ON public.team_members;
CREATE POLICY "tm_select" ON public.team_members FOR SELECT USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR public.user_in_department('recursos-humanos')
  OR public.is_self_team_member(id)
  OR auth.uid() IS NOT NULL
);
DROP POLICY IF EXISTS "tm_external_suspended_block" ON public.team_members;
CREATE POLICY "tm_external_suspended_block" ON public.team_members AS RESTRICTIVE FOR ALL
  TO authenticated
  USING (NOT public.has_role(auth.uid(),'accountant') OR public.accountant_access_enabled());

-- D.4 business_setup
DROP POLICY IF EXISTS "Authenticated can read business_setup" ON public.business_setup;
DROP POLICY IF EXISTS "business_setup_select" ON public.business_setup;
DROP POLICY IF EXISTS "Authenticated users can view business_setup" ON public.business_setup;
DROP POLICY IF EXISTS "bs_select" ON public.business_setup;
CREATE POLICY "bs_select" ON public.business_setup FOR SELECT USING (
  public.is_owner()
  OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.has_role(auth.uid(),'hr')
  OR public.user_in_department('financeiro')
);

-- D.5 suppliers
DROP POLICY IF EXISTS "Authenticated can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can view suppliers" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.user_in_department('financeiro')
  OR public.current_user_has_sensitive_access('financial_values')
);

-- D.5b financial_contractors
DROP POLICY IF EXISTS "Authenticated can read financial_contractors" ON public.financial_contractors;
DROP POLICY IF EXISTS "financial_contractors_select" ON public.financial_contractors;
DROP POLICY IF EXISTS "Authenticated users can view financial_contractors" ON public.financial_contractors;
DROP POLICY IF EXISTS "fc_select" ON public.financial_contractors;
CREATE POLICY "fc_select" ON public.financial_contractors FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.has_role(auth.uid(),'hr')
  OR public.user_in_department('financeiro')
  OR public.current_user_has_sensitive_access('financial_values')
);

-- D.5c financial_documents
DROP POLICY IF EXISTS "Authenticated can read financial_documents" ON public.financial_documents;
DROP POLICY IF EXISTS "financial_documents_select" ON public.financial_documents;
DROP POLICY IF EXISTS "Authenticated users can view financial_documents" ON public.financial_documents;
DROP POLICY IF EXISTS "fd_select" ON public.financial_documents;
CREATE POLICY "fd_select" ON public.financial_documents FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.user_in_department('financeiro')
  OR public.current_user_has_sensitive_access('financial_values')
);

-- D.5d financial_expenses
DROP POLICY IF EXISTS "Authenticated can read financial_expenses" ON public.financial_expenses;
DROP POLICY IF EXISTS "financial_expenses_select" ON public.financial_expenses;
DROP POLICY IF EXISTS "Authenticated users can view financial_expenses" ON public.financial_expenses;
DROP POLICY IF EXISTS "fin_expenses_select_owner_or_sensitive" ON public.financial_expenses;
DROP POLICY IF EXISTS "fe_select" ON public.financial_expenses;
CREATE POLICY "fe_select" ON public.financial_expenses FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.user_in_department('financeiro')
  OR public.current_user_has_sensitive_access('financial_values')
);

-- D.5e financial_payroll
DROP POLICY IF EXISTS "Authenticated can read financial_payroll" ON public.financial_payroll;
DROP POLICY IF EXISTS "financial_payroll_select" ON public.financial_payroll;
DROP POLICY IF EXISTS "Authenticated users can view financial_payroll" ON public.financial_payroll;
DROP POLICY IF EXISTS "fin_payroll_select_owner_or_sensitive" ON public.financial_payroll;
DROP POLICY IF EXISTS "payroll_select" ON public.financial_payroll;
CREATE POLICY "payroll_select" ON public.financial_payroll FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.user_in_department('recursos-humanos')
  OR public.user_in_department('financeiro')
  OR public.current_user_has_sensitive_access('payroll')
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id=auth.uid())
);

-- D.6 crm_leads
DROP POLICY IF EXISTS "Authenticated can read crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "crm_leads_select" ON public.crm_leads;
DROP POLICY IF EXISTS "Authenticated users can view crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "leads_select" ON public.crm_leads;
CREATE POLICY "leads_select" ON public.crm_leads FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'sales')
  OR public.user_in_department('comercial')
  OR responsible_id = public.current_team_member_id()
  OR created_by = auth.uid()
);

-- D.7 commercial_sales
DROP POLICY IF EXISTS "Authenticated can read commercial_sales" ON public.commercial_sales;
DROP POLICY IF EXISTS "commercial_sales_select" ON public.commercial_sales;
DROP POLICY IF EXISTS "Authenticated users can view commercial_sales" ON public.commercial_sales;
DROP POLICY IF EXISTS "sales_select" ON public.commercial_sales;
CREATE POLICY "sales_select" ON public.commercial_sales FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR (public.has_role(auth.uid(),'accountant') AND public.accountant_access_enabled())
  OR public.has_role(auth.uid(),'admin_staff')
  OR public.user_in_department('financeiro')
  OR public.user_in_department('comercial')
  OR (public.has_role(auth.uid(),'sales') AND (
        assigned_to = auth.uid() OR created_by = auth.uid()
        OR EXISTS(
          SELECT 1 FROM public.clients c
          WHERE c.full_name = commercial_sales.client AND public.user_can_access_client(c.id)
        )
      ))
);

-- D.8 business_legal_documents (só owner)
DROP POLICY IF EXISTS "Authenticated can read business_legal_documents" ON public.business_legal_documents;
DROP POLICY IF EXISTS "business_legal_documents_select" ON public.business_legal_documents;
DROP POLICY IF EXISTS "Authenticated users can view business_legal_documents" ON public.business_legal_documents;
DROP POLICY IF EXISTS "bld_owner_only" ON public.business_legal_documents;
DROP POLICY IF EXISTS "Owners manage legal documents" ON public.business_legal_documents;
DROP POLICY IF EXISTS "bld_select_owner_only" ON public.business_legal_documents;
DROP POLICY IF EXISTS "bld_write_owner_only" ON public.business_legal_documents;
CREATE POLICY "bld_select_owner_only" ON public.business_legal_documents FOR SELECT
  USING (public.is_owner());
CREATE POLICY "bld_write_owner_only" ON public.business_legal_documents FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- D.9 member_contracts
DROP POLICY IF EXISTS "Authenticated can read member_contracts" ON public.member_contracts;
DROP POLICY IF EXISTS "member_contracts_select" ON public.member_contracts;
DROP POLICY IF EXISTS "Authenticated users can view member_contracts" ON public.member_contracts;
DROP POLICY IF EXISTS "mc_select" ON public.member_contracts;
CREATE POLICY "mc_select" ON public.member_contracts FOR SELECT USING (
  public.is_owner() OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'hr')
  OR public.user_in_department('recursos-humanos')
  OR public.is_self_team_member(member_id)
);

-- E — Lockdown bucket portal-uploads ==================================
UPDATE storage.buckets SET public = false WHERE id = 'portal-uploads';

DROP POLICY IF EXISTS "portal-uploads: authenticated can upload" ON storage.objects;
DROP POLICY IF EXISTS "portal-uploads: authenticated can read"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload portal files" ON storage.objects;
DROP POLICY IF EXISTS "portal_uploads_internal_read" ON storage.objects;

CREATE POLICY "portal_uploads_internal_read" ON storage.objects FOR SELECT
  USING (bucket_id='portal-uploads' AND auth.uid() IS NOT NULL);
