-- 1) Storage: add UPDATE policy for product-files (owners only)
DROP POLICY IF EXISTS "Owners can update product files" ON storage.objects;
CREATE POLICY "Owners can update product files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-files' AND public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (bucket_id = 'product-files' AND public.has_role(auth.uid(), 'owner'::app_role));

-- 2) Realtime: restrict broadcast/presence publishing to user-scoped topics
DROP POLICY IF EXISTS "realtime_topic_insert_scoped_to_user" ON realtime.messages;
CREATE POLICY "realtime_topic_insert_scoped_to_user"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (realtime.topic() = ('user:' || auth.uid()::text));