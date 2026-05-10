-- Restringir LIST nos buckets públicos a authenticated.
-- (URLs diretos continuam a funcionar via CDN público porque o bucket está public=true.)
DO $$
DECLARE
  pol record;
  pub_buckets text[] := ARRAY[
    'brand-files','brand-section-files','channel-covers','content-files',
    'custom-fonts','entity-icons','logos','personal-images','process-covers'
  ];
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND cmd='SELECT'
      AND (
        qual LIKE '%''brand-files''%' OR
        qual LIKE '%''brand-section-files''%' OR
        qual LIKE '%''channel-covers''%' OR
        qual LIKE '%''content-files''%' OR
        qual LIKE '%''custom-fonts''%' OR
        qual LIKE '%''entity-icons''%' OR
        qual LIKE '%''logos''%' OR
        qual LIKE '%''personal-images''%' OR
        qual LIKE '%''process-covers''%'
      )
      AND qual NOT LIKE '%auth.uid()%'
      AND qual NOT LIKE '%auth.role()%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Política unificada: authenticated pode listar/aceder via API a qualquer um destes buckets
CREATE POLICY "Authenticated can list public buckets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN (
  'brand-files','brand-section-files','channel-covers','content-files',
  'custom-fonts','entity-icons','logos','personal-images','process-covers'
));