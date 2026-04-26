
-- ============================================
-- Phase Security #4 — apply recommended fixes
-- ============================================

-- 1. Public buckets: bloquear LISTAGEM por anónimos.
--    Os ficheiros continuam acessíveis via getPublicUrl (CDN não passa por RLS).
--    Apenas autenticados podem listar/enumerar via API.

DROP POLICY IF EXISTS "Authenticated can list entity icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list fonts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view product files" ON storage.objects;
DROP POLICY IF EXISTS "entity-icons read public" ON storage.objects;

CREATE POLICY "entity-icons authenticated list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'entity-icons');

CREATE POLICY "custom-fonts authenticated list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'custom-fonts');

CREATE POLICY "logos authenticated list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "product-files authenticated list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-files');

-- 2. platform_accesses — restringir SELECT apenas a owner (eram owner+admin).
DROP POLICY IF EXISTS "Owner admin view platform accesses" ON public.platform_accesses;

CREATE POLICY "Only owners can view platform accesses"
  ON public.platform_accesses FOR SELECT
  USING (public.has_role(auth.uid(), 'owner'::app_role));

-- 3. suppressed_emails — permitir service_role inserir (edge functions de unsubscribe).
CREATE POLICY "Service role can insert suppressed emails"
  ON public.suppressed_emails FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
