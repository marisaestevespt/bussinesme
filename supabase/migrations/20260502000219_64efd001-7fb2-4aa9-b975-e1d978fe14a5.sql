-- member_contracts: consolidar SELECT
DROP POLICY IF EXISTS "mc_select" ON public.member_contracts;
DROP POLICY IF EXISTS "Owner self or sensitive views member_contracts" ON public.member_contracts;
CREATE POLICY "member_contracts_select"
ON public.member_contracts FOR SELECT
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR user_in_department('recursos-humanos'::text)
  OR current_user_has_sensitive_access('contracts'::text)
  OR current_user_has_sensitive_access('payroll'::text)
  OR is_self_team_member(member_id)
);

-- financial_payroll: consolidar SELECT
DROP POLICY IF EXISTS "payroll_select" ON public.financial_payroll;
DROP POLICY IF EXISTS "Owner or sensitive views payroll" ON public.financial_payroll;
CREATE POLICY "financial_payroll_select"
ON public.financial_payroll FOR SELECT
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr'::app_role)
  OR (has_role(auth.uid(), 'accountant'::app_role) AND accountant_access_enabled())
  OR user_in_department('recursos-humanos'::text)
  OR user_in_department('financeiro'::text)
  OR current_user_has_sensitive_access('payroll'::text)
  OR current_user_has_sensitive_access('financial_values'::text)
  OR (profile_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))
);

-- financial_expenses: consolidar SELECT
DROP POLICY IF EXISTS "fe_select" ON public.financial_expenses;
DROP POLICY IF EXISTS "Owner or sensitive views expenses" ON public.financial_expenses;
CREATE POLICY "financial_expenses_select"
ON public.financial_expenses FOR SELECT
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'accountant'::app_role) AND accountant_access_enabled())
  OR user_in_department('financeiro'::text)
  OR current_user_has_sensitive_access('financial_values'::text)
);

-- financial_goals: restringir SELECT
DROP POLICY IF EXISTS "fg_select" ON public.financial_goals;
CREATE POLICY "financial_goals_select"
ON public.financial_goals FOR SELECT
USING (
  is_owner()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'accountant'::app_role) AND accountant_access_enabled())
  OR user_in_department('financeiro'::text)
  OR current_user_has_sensitive_access('financial_values'::text)
);