
CREATE TABLE public.user_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page_key text NOT NULL,
  label text NOT NULL,
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own views" ON public.user_views
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own views" ON public.user_views
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own views" ON public.user_views
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own views" ON public.user_views
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
