INSERT INTO storage.buckets (id, name, public)
VALUES ('entity-icons', 'entity-icons', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "entity-icons read public"
ON storage.objects FOR SELECT
USING (bucket_id = 'entity-icons');

-- Auth write
CREATE POLICY "entity-icons authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'entity-icons');

CREATE POLICY "entity-icons authenticated update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'entity-icons');

CREATE POLICY "entity-icons authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'entity-icons');