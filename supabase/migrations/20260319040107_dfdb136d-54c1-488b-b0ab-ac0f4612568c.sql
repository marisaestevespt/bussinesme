
ALTER TABLE public.products ADD COLUMN logo_url text;
ALTER TABLE public.products ADD COLUMN cover_url text;

INSERT INTO storage.buckets (id, name, public) VALUES ('product-files', 'product-files', true);

CREATE POLICY "Authenticated can view product files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-files');
CREATE POLICY "Owners can upload product files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-files' AND has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can delete product files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-files' AND has_role(auth.uid(), 'owner'::app_role));
