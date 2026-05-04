-- Tornar bucket content-files público (URLs /object/public/... passam a funcionar)
UPDATE storage.buckets SET public = true WHERE id = 'content-files';

-- Garantir leitura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access to content-files'
  ) THEN
    CREATE POLICY "Public read access to content-files"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'content-files');
  END IF;
END $$;

-- Garantir que utilizadores autenticados podem fazer upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload to content-files'
  ) THEN
    CREATE POLICY "Authenticated users can upload to content-files"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'content-files');
  END IF;
END $$;

-- Permitir que utilizadores autenticados apaguem ficheiros (botão eliminar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete content-files'
  ) THEN
    CREATE POLICY "Authenticated users can delete content-files"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'content-files');
  END IF;
END $$;