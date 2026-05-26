DROP POLICY IF EXISTS "Service role can upload monthly reports files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update monthly reports files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete monthly reports files" ON storage.objects;

CREATE POLICY "Service role can upload monthly reports files"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'monthly-reports');

CREATE POLICY "Service role can update monthly reports files"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'monthly-reports')
WITH CHECK (bucket_id = 'monthly-reports');

CREATE POLICY "Service role can delete monthly reports files"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'monthly-reports');