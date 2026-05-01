-- 1) FK em assigned_to → profiles
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2) FK em deliverable_id → project_deliverables
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_deliverable_id_fkey
  FOREIGN KEY (deliverable_id) REFERENCES public.project_deliverables(id) ON DELETE CASCADE;

-- 3) CHECK em tasks.status (valores canónicos atualmente em uso + comuns)
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('por_comecar','em_curso','done','concluida','bloqueada','cancelada','agendada'));