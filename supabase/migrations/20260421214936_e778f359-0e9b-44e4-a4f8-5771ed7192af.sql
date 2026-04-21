
-- Helper: o utilizador atual tem acesso sensível à categoria?
CREATE OR REPLACE FUNCTION public.current_user_has_sensitive_access(_category text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.team_members tm ON tm.profile_id = p.id
    JOIN public.member_sensitive_access msa ON msa.member_id = tm.id
    WHERE p.user_id = auth.uid()
      AND msa.category = _category
      AND msa.granted = true
  );
$$;

-- Helper: o utilizador atual é o "próprio" team_member em causa?
CREATE OR REPLACE FUNCTION public.is_self_team_member(_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.team_members tm ON tm.profile_id = p.id
    WHERE p.user_id = auth.uid() AND tm.id = _member_id
  );
$$;

-- 1. business_setup: voltar a leitura para todos os autenticados
DROP POLICY IF EXISTS "Owner views business_setup" ON public.business_setup;
CREATE POLICY "Authenticated views business_setup"
ON public.business_setup FOR SELECT TO authenticated USING (true);

-- 2. financial_payroll: Owner ou quem tem payroll/financial_values
DROP POLICY IF EXISTS "Owner views payroll" ON public.financial_payroll;
DROP POLICY IF EXISTS "Owner inserts payroll" ON public.financial_payroll;
DROP POLICY IF EXISTS "Owner updates payroll" ON public.financial_payroll;
CREATE POLICY "Owner or sensitive views payroll"
ON public.financial_payroll FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR current_user_has_sensitive_access('payroll')
  OR current_user_has_sensitive_access('financial_values')
);
CREATE POLICY "Owner inserts payroll"
ON public.financial_payroll FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner updates payroll"
ON public.financial_payroll FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- 3. member_contracts: Owner OU acesso a contratos OU o próprio membro
DROP POLICY IF EXISTS "Owner views member_contracts" ON public.member_contracts;
CREATE POLICY "Owner self or sensitive views member_contracts"
ON public.member_contracts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR current_user_has_sensitive_access('contracts')
  OR current_user_has_sensitive_access('payroll')
  OR is_self_team_member(member_id)
);

-- 4. member_payments: Owner OU acesso a payroll OU o próprio membro
DROP POLICY IF EXISTS "Owner views member_payments" ON public.member_payments;
CREATE POLICY "Owner self or sensitive views member_payments"
ON public.member_payments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR current_user_has_sensitive_access('payroll')
  OR is_self_team_member(member_id)
);
