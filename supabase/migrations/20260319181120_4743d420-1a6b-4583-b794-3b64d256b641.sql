-- Add accent color to business_settings
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '0 0% 50%';

-- Create storage bucket for custom fonts
INSERT INTO storage.buckets (id, name, public) VALUES ('custom-fonts', 'custom-fonts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view fonts" ON storage.objects FOR SELECT USING (bucket_id = 'custom-fonts');
CREATE POLICY "Authenticated users can upload fonts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'custom-fonts' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update fonts" ON storage.objects FOR UPDATE USING (bucket_id = 'custom-fonts' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete fonts" ON storage.objects FOR DELETE USING (bucket_id = 'custom-fonts' AND auth.role() = 'authenticated');

-- Create table for custom fonts
CREATE TABLE public.custom_fonts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  font_name text NOT NULL,
  font_url text NOT NULL,
  font_type text NOT NULL DEFAULT 'display',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_fonts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view custom fonts" ON public.custom_fonts FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage custom fonts" ON public.custom_fonts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update custom fonts" ON public.custom_fonts FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can delete custom fonts" ON public.custom_fonts FOR DELETE USING (auth.role() = 'authenticated');