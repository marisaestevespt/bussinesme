CREATE TABLE IF NOT EXISTS public.user_task_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'today',
  name text NOT NULL,
  view_type text NOT NULL DEFAULT 'list',
  group_by text DEFAULT 'none',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_task_views_user ON public.user_task_views(user_id, scope, sort_order);

ALTER TABLE public.user_task_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own task views" ON public.user_task_views
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own task views" ON public.user_task_views
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own task views" ON public.user_task_views
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own task views" ON public.user_task_views
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_task_views_updated
  BEFORE UPDATE ON public.user_task_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();