-- 1. Mudar default da coluna
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'por_comecar';

-- 2. Normalizar dados existentes
UPDATE public.tasks SET status = 'por_comecar' WHERE status = 'pendente';

-- 3. Atualizar trigger sync_deliverable_to_task
CREATE OR REPLACE FUNCTION public.sync_deliverable_to_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing_task_id uuid;
  _assignee uuid;
  _project_dept text;
BEGIN
  IF COALESCE(NEW.is_meeting, false) = true OR COALESCE(NEW.responsible_type, 'equipa') <> 'equipa' THEN
    DELETE FROM public.tasks WHERE deliverable_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id INTO _existing_task_id FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;
  _assignee := public.resolve_deliverable_assignee(NEW.id);
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;

  IF _existing_task_id IS NULL THEN
    INSERT INTO public.tasks (
      name, status, priority, project_id, department,
      deadline, assigned_to, deliverable_id
    ) VALUES (
      NEW.name,
      CASE WHEN NEW.status IN ('concluido','entregue') THEN 'done' ELSE 'por_comecar' END,
      'media',
      NEW.project_id,
      _project_dept,
      NEW.planned_end,
      _assignee,
      NEW.id
    );
  ELSE
    UPDATE public.tasks
    SET name = NEW.name,
        deadline = NEW.planned_end,
        project_id = NEW.project_id,
        assigned_to = COALESCE(assigned_to, _assignee),
        status = CASE
          WHEN NEW.status IN ('concluido','entregue') THEN 'done'
          WHEN status IN ('done','concluida') AND NEW.status NOT IN ('concluido','entregue') THEN 'por_comecar'
          ELSE status
        END,
        updated_at = now()
    WHERE id = _existing_task_id;
  END IF;

  RETURN NEW;
END;
$$;