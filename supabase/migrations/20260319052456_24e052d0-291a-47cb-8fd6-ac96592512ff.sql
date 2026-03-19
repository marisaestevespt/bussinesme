
-- Add documents column to financial_subscriptions
ALTER TABLE public.financial_subscriptions ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;

-- Create financial-files storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('financial-files', 'financial-files', true) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/read
CREATE POLICY "Authenticated users can upload financial files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'financial-files');
CREATE POLICY "Anyone can read financial files" ON storage.objects FOR SELECT USING (bucket_id = 'financial-files');
CREATE POLICY "Authenticated users can delete financial files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'financial-files');
