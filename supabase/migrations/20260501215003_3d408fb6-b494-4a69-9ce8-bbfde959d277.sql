-- I.A
DELETE FROM public.financial_expenses 
WHERE id IN (
  '5ac99d19-1164-4c7d-a22b-d9be0f5ee35c',
  '8b7fde16-97a9-4547-af0c-67493480b2be',
  '7c63d096-edfc-4e70-b66f-fa9527baa3d8'
);

-- I.B
DROP POLICY IF EXISTS "auth manage fiscal_deadline_completions" ON public.fiscal_deadline_completions;
DROP POLICY IF EXISTS "Authenticated users can manage fiscal checks" ON public.fiscal_monthly_checks;

CREATE POLICY "Owner/admin/financeiro manages fiscal_deadline_completions"
ON public.fiscal_deadline_completions FOR ALL TO authenticated
USING (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR current_user_has_sensitive_access('financial_values'::text))
WITH CHECK (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR current_user_has_sensitive_access('financial_values'::text));

CREATE POLICY "Owner/admin/financeiro manages fiscal_monthly_checks"
ON public.fiscal_monthly_checks FOR ALL TO authenticated
USING (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR current_user_has_sensitive_access('financial_values'::text))
WITH CHECK (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR current_user_has_sensitive_access('financial_values'::text));

-- I.C
DROP POLICY IF EXISTS "auth manage product_costs" ON public.product_costs;
DROP POLICY IF EXISTS "auth manage product_payment_methods" ON public.product_payment_methods;

CREATE POLICY "product_costs_select" ON public.product_costs FOR SELECT TO authenticated
USING (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR current_user_has_sensitive_access('financial_values'::text));

CREATE POLICY "product_costs_write" ON public.product_costs FOR ALL TO authenticated
USING (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR current_user_has_sensitive_access('financial_values'::text))
WITH CHECK (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR current_user_has_sensitive_access('financial_values'::text));

CREATE POLICY "product_payment_methods_select" ON public.product_payment_methods FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "product_payment_methods_write" ON public.product_payment_methods FOR ALL TO authenticated
USING (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR user_in_department('comercial'::text))
WITH CHECK (is_owner() OR has_role(auth.uid(),'admin'::app_role) OR user_in_department('financeiro'::text) OR user_in_department('comercial'::text));

-- I.D
ALTER TABLE public.financial_expenses DROP CONSTRAINT IF EXISTS financial_expenses_parent_expense_id_fkey;
ALTER TABLE public.financial_expenses 
  ADD CONSTRAINT financial_expenses_parent_expense_id_fkey 
  FOREIGN KEY (parent_expense_id) REFERENCES public.financial_expenses(id) ON DELETE SET NULL;

-- I.E
ALTER TABLE public.financial_expenses DROP CONSTRAINT IF EXISTS financial_expenses_supplier_id_fkey;
ALTER TABLE public.financial_expenses 
  ADD CONSTRAINT financial_expenses_supplier_id_fkey 
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- I.F
ALTER TABLE public.financial_expenses DROP CONSTRAINT IF EXISTS financial_expenses_status_check;
ALTER TABLE public.financial_expenses 
  ADD CONSTRAINT financial_expenses_status_check 
  CHECK (status IN ('pendente','por_pagar','pago_falta_fatura','tudo_ok'));

ALTER TABLE public.member_payments DROP CONSTRAINT IF EXISTS member_payments_status_check;
ALTER TABLE public.member_payments 
  ADD CONSTRAINT member_payments_status_check 
  CHECK (status IN ('pendente','por_pagar','pago_falta_fatura','tudo_ok'));

ALTER TABLE public.financial_contractors DROP CONSTRAINT IF EXISTS financial_contractors_status_check;
ALTER TABLE public.financial_contractors 
  ADD CONSTRAINT financial_contractors_status_check 
  CHECK (status IN ('pendente','por_pagar','pago_falta_fatura','tudo_ok'));

-- I.G — incluindo 'subscription' (em uso) e removendo valores não usados
ALTER TABLE public.financial_categories DROP CONSTRAINT IF EXISTS financial_categories_type_check;
ALTER TABLE public.financial_categories 
  ADD CONSTRAINT financial_categories_type_check 
  CHECK (category_type IN ('expense','subscription','payment_method'));