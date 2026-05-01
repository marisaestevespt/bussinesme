
-- Helper
CREATE OR REPLACE FUNCTION public.can_edit_task(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    LEFT JOIN public.profiles p_assignee ON p_assignee.id = t.assigned_to
    LEFT JOIN public.project_members pm ON pm.project_id = t.project_id
    LEFT JOIN public.profiles p_member ON p_member.id = pm.profile_id
    WHERE t.id = _task_id
      AND (
        t.created_by = auth.uid()
        OR p_assignee.user_id = auth.uid()
        OR is_admin_or_owner()
        OR p_member.user_id = auth.uid()
      )
  )
$$;

DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owners can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creator/assignee/admin/project member can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Creator/assignee/admin can delete tasks" ON public.tasks;

CREATE POLICY "Creator/assignee/admin/project member can update tasks"
ON public.tasks
FOR UPDATE
USING (public.can_edit_task(id))
WITH CHECK (public.can_edit_task(id));

CREATE POLICY "Creator/assignee/admin can delete tasks"
ON public.tasks
FOR DELETE
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = tasks.assigned_to AND p.user_id = auth.uid())
  OR is_admin_or_owner()
);

DROP POLICY IF EXISTS "Authenticated can insert task dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "Authenticated can update task dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "Authenticated can delete task dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "Can manage deps if can edit task" ON public.task_dependencies;
DROP POLICY IF EXISTS "Can update deps if can edit task" ON public.task_dependencies;
DROP POLICY IF EXISTS "Can delete deps if can edit task" ON public.task_dependencies;

CREATE POLICY "Can manage deps if can edit task"
ON public.task_dependencies
FOR INSERT
WITH CHECK (public.can_edit_task(task_id));

CREATE POLICY "Can update deps if can edit task"
ON public.task_dependencies
FOR UPDATE
USING (public.can_edit_task(task_id))
WITH CHECK (public.can_edit_task(task_id));

CREATE POLICY "Can delete deps if can edit task"
ON public.task_dependencies
FOR DELETE
USING (public.can_edit_task(task_id));

-- Substituir tasks_status_check (faltavam estados atuais)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'por_comecar', 'a_fazer', 'aguarda_feedback', 'para_aprovacao',
    'precisa_alteracoes', 'done',
    -- legacy / compat
    'em_curso', 'concluida', 'bloqueada', 'cancelada', 'agendada',
    'pendente', 'in_progress', 'todo', 'completed'
  ));

-- L1.H: CHECK constraint em tasks.priority
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('alta', 'media', 'baixa'));
