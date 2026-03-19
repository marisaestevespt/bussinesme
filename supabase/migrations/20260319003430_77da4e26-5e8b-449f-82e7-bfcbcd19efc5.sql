
CREATE TABLE public.task_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0,
  is_manual boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view time entries"
  ON public.task_time_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own time entries"
  ON public.task_time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own time entries"
  ON public.task_time_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own time entries"
  ON public.task_time_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid());
