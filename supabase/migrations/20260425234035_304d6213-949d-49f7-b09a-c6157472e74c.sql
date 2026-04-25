-- ============================================
-- portal-uploads: políticas INSERT/UPDATE/DELETE em falta
-- ============================================
DROP POLICY IF EXISTS "portal_uploads_authenticated_insert" ON storage.objects;
CREATE POLICY "portal_uploads_authenticated_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'portal-uploads');

DROP POLICY IF EXISTS "portal_uploads_owner_admin_update" ON storage.objects;
CREATE POLICY "portal_uploads_owner_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'portal-uploads' 
  AND (is_owner() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'admin_staff'::app_role))
);

DROP POLICY IF EXISTS "portal_uploads_owner_admin_delete" ON storage.objects;
CREATE POLICY "portal_uploads_owner_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'portal-uploads' 
  AND (is_owner() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'admin_staff'::app_role))
);

-- ============================================
-- backups: só service_role escreve, só owner lê/apaga
-- ============================================
DROP POLICY IF EXISTS "backups_service_insert" ON storage.objects;
CREATE POLICY "backups_service_insert"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'backups');

DROP POLICY IF EXISTS "backups_owner_delete" ON storage.objects;
CREATE POLICY "backups_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'backups' AND is_owner());

DROP POLICY IF EXISTS "backups_owner_update" ON storage.objects;
CREATE POLICY "backups_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'backups' AND is_owner());