
CREATE TABLE public.page_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_path)
);

ALTER TABLE public.page_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read page_access_grants"
  ON public.page_access_grants FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owners can manage page_access_grants"
  ON public.page_access_grants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
