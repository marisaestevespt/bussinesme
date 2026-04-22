-- 1. Remover policies de storage antigas que conflituam (PERMISSIVE OR-bypass)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (
        policyname ILIKE '%upload%financial%' OR
        policyname ILIKE '%delete%financial%' OR
        policyname ILIKE '%update%financial%' OR
        policyname ILIKE '%read%financial%' OR
        policyname ILIKE '%view%financial%' OR
        policyname ILIKE '%upload%library%' OR
        policyname ILIKE '%delete%library%' OR
        policyname ILIKE '%update%library%' OR
        policyname ILIKE '%read%library%' OR
        policyname ILIKE '%view%library%'
      )
      AND policyname NOT ILIKE '%owner or sensitive%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- 2. portal-uploads: só autenticados podem fazer upload
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname ILIKE '%portal%upload%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "portal-uploads: authenticated can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'portal-uploads');

CREATE POLICY "portal-uploads: authenticated can read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'portal-uploads');

-- 3. member_sensitive_access: SELECT owner-only
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='member_sensitive_access' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.member_sensitive_access', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Only owners can view sensitive access grants"
ON public.member_sensitive_access FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 4. page_access_grants: own + owner
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='page_access_grants' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.page_access_grants', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users see own grants, owners see all"
ON public.page_access_grants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'owner'::app_role)
);

-- 5. portal_visits: SELECT owner/admin only
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='portal_visits' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.portal_visits', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Owners and admins can view portal visits"
ON public.portal_visits FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);