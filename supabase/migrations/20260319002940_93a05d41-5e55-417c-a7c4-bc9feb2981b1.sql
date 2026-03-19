
-- Add parent_task_id for subtasks
ALTER TABLE public.tasks ADD COLUMN parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Create task_dependencies table
CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

-- Enable RLS
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_dependencies (same pattern as tasks)
CREATE POLICY "Authenticated can view task dependencies"
  ON public.task_dependencies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert task dependencies"
  ON public.task_dependencies FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update task dependencies"
  ON public.task_dependencies FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete task dependencies"
  ON public.task_dependencies FOR DELETE TO authenticated
  USING (true);
