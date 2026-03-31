CREATE POLICY "Authenticated users can upload personal images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'personal-images');