INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload project files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "Anyone can view project files" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'project-files');

CREATE POLICY "Owners can delete project files" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'project-files' AND public.has_role(auth.uid(), 'owner'::public.app_role));