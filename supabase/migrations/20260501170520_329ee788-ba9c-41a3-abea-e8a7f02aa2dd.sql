-- 1. Add cover_url to marketing_channels
ALTER TABLE public.marketing_channels
  ADD COLUMN IF NOT EXISTS cover_url text;

-- 2. Create public bucket for channel covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('channel-covers', 'channel-covers', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects for channel-covers
DROP POLICY IF EXISTS "Channel covers are publicly readable" ON storage.objects;
CREATE POLICY "Channel covers are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'channel-covers');

DROP POLICY IF EXISTS "Owners can upload channel covers" ON storage.objects;
CREATE POLICY "Owners can upload channel covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'channel-covers' AND public.has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Owners can update channel covers" ON storage.objects;
CREATE POLICY "Owners can update channel covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'channel-covers' AND public.has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Owners can delete channel covers" ON storage.objects;
CREATE POLICY "Owners can delete channel covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'channel-covers' AND public.has_role(auth.uid(), 'owner'::app_role));