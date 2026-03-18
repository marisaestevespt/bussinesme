
-- Mural posts
CREATE TABLE public.mural_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outro',
  images JSONB DEFAULT '[]'::jsonb,
  files JSONB DEFAULT '[]'::jsonb,
  author_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mural_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mural posts" ON public.mural_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Publishers can insert mural posts" ON public.mural_posts FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  OR EXISTS (
    SELECT 1 FROM members m
    JOIN role_permissions rp ON rp.custom_role_id = m.custom_role_id
    WHERE m.user_id = auth.uid() AND rp.module_key = 'mural_publish' AND rp.can_view = true
  )
);
CREATE POLICY "Authors and owners can update mural posts" ON public.mural_posts FOR UPDATE TO authenticated USING (
  author_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role)
);
CREATE POLICY "Owners can delete mural posts" ON public.mural_posts FOR DELETE TO authenticated USING (
  has_role(auth.uid(), 'owner'::app_role)
);

-- Mural reactions
CREATE TABLE public.mural_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

ALTER TABLE public.mural_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reactions" ON public.mural_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own reactions" ON public.mural_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own reactions" ON public.mural_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Mural comments
CREATE TABLE public.mural_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.mural_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mural_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view comments" ON public.mural_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own comments" ON public.mural_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON public.mural_comments FOR DELETE TO authenticated USING (
  author_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role)
);

-- Storage bucket for mural files
INSERT INTO storage.buckets (id, name, public) VALUES ('mural-files', 'mural-files', true);

CREATE POLICY "Authenticated can upload mural files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mural-files');
CREATE POLICY "Anyone can view mural files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'mural-files');
CREATE POLICY "Owners can delete mural files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mural-files' AND has_role(auth.uid(), 'owner'::app_role));
