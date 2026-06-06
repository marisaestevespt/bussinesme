
DROP POLICY IF EXISTS "Authenticated users can view legal doc files" ON storage.objects;

CREATE POLICY "Legal doc files: owner/admin read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'business-legal-docs'
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
