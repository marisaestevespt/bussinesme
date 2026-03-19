
-- Personal notes per member (keyed by user_id from auth)
CREATE TABLE public.member_personal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_personal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON public.member_personal_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Personal links per member
CREATE TABLE public.member_personal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_personal_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own links" ON public.member_personal_links FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Personal image per member
CREATE TABLE public.member_personal_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  image_url text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_personal_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own image" ON public.member_personal_images FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for personal images
INSERT INTO storage.buckets (id, name, public) VALUES ('personal-images', 'personal-images', true);
CREATE POLICY "Users upload own personal images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'personal-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own personal images" ON storage.objects FOR UPDATE USING (bucket_id = 'personal-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own personal images" ON storage.objects FOR DELETE USING (bucket_id = 'personal-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Personal images are publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'personal-images');
