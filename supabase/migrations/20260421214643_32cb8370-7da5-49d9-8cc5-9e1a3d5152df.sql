
-- 1. client_portals — remover anon SELECT
DROP POLICY IF EXISTS "Portal publicly readable by token" ON public.client_portals;
DROP POLICY IF EXISTS "Anon can view portal by token or slug" ON public.client_portals;

-- 2. platform_accesses — SELECT só Owner/Admin
DROP POLICY IF EXISTS "Authenticated can view platform accesses" ON public.platform_accesses;
CREATE POLICY "Owner admin view platform accesses"
ON public.platform_accesses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 3. financial_payroll — só Owner
DROP POLICY IF EXISTS "Authenticated can view payroll" ON public.financial_payroll;
DROP POLICY IF EXISTS "Authenticated can update payroll" ON public.financial_payroll;
DROP POLICY IF EXISTS "Authenticated can insert payroll" ON public.financial_payroll;
CREATE POLICY "Owner views payroll" ON public.financial_payroll FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner inserts payroll" ON public.financial_payroll FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owner updates payroll" ON public.financial_payroll FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- 4. team_members — UPDATE só Owner ou o próprio
DROP POLICY IF EXISTS "Authenticated users can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can update team members" ON public.team_members;
CREATE POLICY "Owner or self updates team_members"
ON public.team_members FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'owner'::app_role)
  OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 5. business_setup — SELECT só Owner
DROP POLICY IF EXISTS "Authenticated can view business_setup" ON public.business_setup;
CREATE POLICY "Owner views business_setup" ON public.business_setup FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- 6. member_contracts e member_payments — SELECT só Owner
DROP POLICY IF EXISTS "Authenticated can view member_contracts" ON public.member_contracts;
CREATE POLICY "Owner views member_contracts" ON public.member_contracts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));
DROP POLICY IF EXISTS "Authenticated can view member_payments" ON public.member_payments;
CREATE POLICY "Owner views member_payments" ON public.member_payments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role));

-- 7. portal_visits — insert anon só se portal ativo
DROP POLICY IF EXISTS "Anyone can log portal visits" ON public.portal_visits;
CREATE POLICY "Log portal visits only for active portals"
ON public.portal_visits FOR INSERT TO public
WITH CHECK (portal_id IN (SELECT id FROM public.client_portals WHERE is_active = true));

-- 8. product_onboarding_templates — SELECT só autenticado
DROP POLICY IF EXISTS "Anyone can view product onboarding templates" ON public.product_onboarding_templates;
CREATE POLICY "Authenticated view product onboarding templates"
ON public.product_onboarding_templates FOR SELECT TO authenticated USING (true);

-- 9. suppliers — escrita só Owner/Admin
DROP POLICY IF EXISTS "Authenticated users can manage suppliers" ON public.suppliers;
CREATE POLICY "Authenticated view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner admin insert suppliers" ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner admin update suppliers" ON public.suppliers FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner admin delete suppliers" ON public.suppliers FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 10. Storage portal-uploads — bloquear upload anónimo
DROP POLICY IF EXISTS "Anyone can upload to portal-uploads" ON storage.objects;
