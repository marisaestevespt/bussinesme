
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='backups') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.backups';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='financial_categories') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.financial_categories';
  END IF;
END $$;

DROP POLICY IF EXISTS portal_uploads_authenticated_insert ON storage.objects;

CREATE POLICY portal_uploads_authenticated_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portal-uploads'
  AND (
    public.has_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.client_portals cp
      WHERE cp.token::text = (storage.foldername(name))[1]
        AND public.user_can_access_client(cp.client_id)
    )
  )
);
