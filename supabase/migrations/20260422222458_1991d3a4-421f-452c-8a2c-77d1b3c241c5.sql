-- 1. platform_accesses: UPDATE owner-only
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='platform_accesses' AND cmd='UPDATE' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.platform_accesses', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Only owners can update platform accesses"
ON public.platform_accesses FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

-- 2. portal_visits: INSERT exige token activo
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='portal_visits' AND cmd='INSERT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.portal_visits', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anon can log visit only for active portals"
ON public.portal_visits FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_portals cp
    WHERE cp.id = portal_visits.portal_id AND cp.is_active = true
  )
);

-- 3. financial-files bucket
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname ILIKE '%financial-files%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "financial-files: owner or sensitive can read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'financial-files'
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.current_user_has_sensitive_access('financial_values')));

CREATE POLICY "financial-files: owner or sensitive can insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'financial-files'
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.current_user_has_sensitive_access('financial_values')));

CREATE POLICY "financial-files: owner or sensitive can update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'financial-files'
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.current_user_has_sensitive_access('financial_values')));

CREATE POLICY "financial-files: owner or sensitive can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'financial-files'
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.current_user_has_sensitive_access('financial_values')));

-- 4. library-files bucket
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname ILIKE '%library-files%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "library-files: owner or sensitive can read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'library-files'
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.current_user_has_sensitive_access('financial_values')
       OR public.current_user_has_sensitive_access('contracts')));

CREATE POLICY "library-files: owner or sensitive can insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'library-files'
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.current_user_has_sensitive_access('financial_values')
       OR public.current_user_has_sensitive_access('contracts')));

CREATE POLICY "library-files: owner or sensitive can update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'library-files'
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.current_user_has_sensitive_access('financial_values')
       OR public.current_user_has_sensitive_access('contracts')));

CREATE POLICY "library-files: owner or sensitive can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'library-files'
  AND (public.has_role(auth.uid(), 'owner'::app_role)
       OR public.current_user_has_sensitive_access('financial_values')
       OR public.current_user_has_sensitive_access('contracts')));

-- 5. Public views (sem campos sensíveis)
CREATE OR REPLACE VIEW public.clients_public
WITH (security_invoker=on) AS
SELECT
  id, client_id, full_name, email, status, current_product, current_product_id,
  start_date, end_of_cycle, conversion_date, dp, observations,
  drive_folder_url, documents, whatsapp_group_url, created_at, updated_at,
  created_by, client_files, portal_deactivation_date
FROM public.clients;

GRANT SELECT ON public.clients_public TO authenticated;

CREATE OR REPLACE VIEW public.team_members_public
WITH (security_invoker=on) AS
SELECT
  id, full_name, email, status, role_title, profile_id, photo_url,
  expected_weekly_hours, custom_role_id, work_areas, departments, department,
  start_date, member_type, presentation, responsibilities, role_color,
  work_schedule, works_holidays, custom_holidays,
  created_at, updated_at
FROM public.team_members;

GRANT SELECT ON public.team_members_public TO authenticated;

CREATE OR REPLACE VIEW public.suppliers_public
WITH (security_invoker=on) AS
SELECT
  id, name, category, default_vat_rate, is_active, notes,
  contract_start_date, contract_end_date, last_renewal_date,
  member_id, expense_description_template, location,
  website, created_at, updated_at
FROM public.suppliers;

GRANT SELECT ON public.suppliers_public TO authenticated;

CREATE OR REPLACE VIEW public.business_setup_public
WITH (security_invoker=on) AS
SELECT
  id, business_legal_name, payment_methods, regime_iva, regime_fiscal,
  business_email, business_website, cae_principal, cae_secundarios,
  notas, created_at, updated_at
FROM public.business_setup;

GRANT SELECT ON public.business_setup_public TO authenticated;

CREATE OR REPLACE VIEW public.client_contacts_public
WITH (security_invoker=on) AS
SELECT
  id, client_id, name, notes, created_at
FROM public.client_contacts;

GRANT SELECT ON public.client_contacts_public TO authenticated;