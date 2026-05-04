ALTER TABLE public.content_attachments
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_content_attachments_sort
  ON public.content_attachments (content_id, sort_order, created_at);

-- Inicializar sort_order com base na ordem atual (created_at) por content_id
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY content_id ORDER BY created_at) - 1 AS rn
  FROM public.content_attachments
)
UPDATE public.content_attachments ca
SET sort_order = ranked.rn
FROM ranked
WHERE ca.id = ranked.id AND ca.sort_order = 0;

-- Permitir que utilizadores autenticados atualizem (necessário para reordenar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'content_attachments'
      AND policyname = 'Authenticated can update content attachments'
  ) THEN
    CREATE POLICY "Authenticated can update content attachments"
      ON public.content_attachments FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;