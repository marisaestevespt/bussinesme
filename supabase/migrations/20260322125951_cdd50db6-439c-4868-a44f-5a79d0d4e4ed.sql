INSERT INTO storage.buckets (id, name, public) VALUES ('library-files', 'library-files', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read library files" ON storage.objects FOR SELECT USING (bucket_id = 'library-files');
CREATE POLICY "Authenticated users can upload library files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'library-files');
CREATE POLICY "Authenticated users can delete library files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'library-files');