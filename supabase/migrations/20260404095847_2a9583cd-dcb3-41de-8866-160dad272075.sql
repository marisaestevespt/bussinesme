
ALTER TABLE public.portal_initial_questions
  ADD COLUMN IF NOT EXISTS answer_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS file_urls jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.portal_initial_questions.answer_type IS 'text, file, or image';
COMMENT ON COLUMN public.portal_initial_questions.file_urls IS 'Array of uploaded file URLs for file/image answers';

-- Create a bucket for portal question uploads if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-uploads', 'portal-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read portal uploads (public portal)
CREATE POLICY "Portal uploads are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'portal-uploads');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload portal files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portal-uploads');

-- Allow anyone to upload to portal-uploads (portal users aren't authenticated)
CREATE POLICY "Anyone can upload to portal-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portal-uploads' AND auth.role() = 'anon');
