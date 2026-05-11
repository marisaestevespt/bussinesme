CREATE TABLE public.marketing_idea_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  filter_channel text,
  filter_content_type text,
  filter_format text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_idea_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view idea views"
  ON public.marketing_idea_views FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert idea views"
  ON public.marketing_idea_views FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update idea views"
  ON public.marketing_idea_views FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can delete idea views"
  ON public.marketing_idea_views FOR DELETE USING (has_role(auth.uid(), 'owner'::app_role) AND is_system = false);

CREATE POLICY "block_suspended_marketing_idea_views"
  ON public.marketing_idea_views AS RESTRICTIVE FOR ALL USING (NOT current_user_is_suspended());

CREATE TRIGGER update_marketing_idea_views_updated_at
  BEFORE UPDATE ON public.marketing_idea_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.marketing_idea_views (name, category, sort_order, is_system) VALUES
  ('Todas', NULL, 0, true),
  ('Publicações', 'publicacoes', 1, true),
  ('Stories', 'stories', 2, true),
  ('Caixa de Perguntas', 'caixa_perguntas', 3, true);