CREATE TABLE public.secretaria_custom_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('today','week','tasks')),
  name TEXT NOT NULL,
  layout TEXT NOT NULL DEFAULT 'table' CHECK (layout IN ('table','list','board')),
  columns JSONB NOT NULL DEFAULT '["task","status","priority","deadline","project"]'::jsonb,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  group_by TEXT NOT NULL DEFAULT 'none',
  sort_by TEXT NOT NULL DEFAULT 'deadline_asc',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_secretaria_custom_views_user_scope
  ON public.secretaria_custom_views(user_id, scope, sort_order);

ALTER TABLE public.secretaria_custom_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own secretaria views"
  ON public.secretaria_custom_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own secretaria views"
  ON public.secretaria_custom_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own secretaria views"
  ON public.secretaria_custom_views FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own secretaria views"
  ON public.secretaria_custom_views FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_secretaria_custom_views_updated_at
  BEFORE UPDATE ON public.secretaria_custom_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();