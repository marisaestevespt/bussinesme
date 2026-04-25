-- 1. Remover UPDATE permissivo em team_members
DROP POLICY IF EXISTS "Authenticated can update team_members" ON public.team_members;

-- 2. Políticas para commercial-library
CREATE POLICY "commercial_library_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'commercial-library'
    AND (
      public.is_admin_or_owner()
      OR public.has_role(auth.uid(), 'sales'::app_role)
      OR public.user_in_department('comercial'::text)
    )
  );

CREATE POLICY "commercial_library_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'commercial-library'
    AND (
      public.is_admin_or_owner()
      OR public.user_in_department('comercial'::text)
    )
  );

CREATE POLICY "commercial_library_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'commercial-library'
    AND public.is_admin_or_owner()
  );

CREATE POLICY "commercial_library_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'commercial-library'
    AND public.is_admin_or_owner()
  );