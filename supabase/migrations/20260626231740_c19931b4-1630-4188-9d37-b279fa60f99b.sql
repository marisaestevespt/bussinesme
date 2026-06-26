DROP POLICY IF EXISTS "product-files authenticated list" ON storage.objects;

CREATE POLICY "Owners can list product files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-files'
  AND public.has_role(auth.uid(), 'owner'::public.app_role)
);