CREATE OR REPLACE FUNCTION public.sync_deliverable_to_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existing_task_id uuid;
  _existing_estimated integer;
  _assignee uuid;
  _project_dept text;
  _task_deadline date;
BEGIN
  -- Anti-loop: se já estamos a propagar de task→deliverable, não reentrar
  IF current_setting('app.deliv_task_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_meeting, false) = true
     OR COALESCE(NEW.responsible_type, 'equipa') NOT IN ('equipa','ambos')
     OR NEW.deliverable_type IN ('reuniao', 'link', 'documento', 'aprovacao') THEN
    PERFORM set_config('app.deliv_task_sync', 'on', true);
    DELETE FROM public.tasks WHERE deliverable_id = NEW.id;
    PERFORM set_config('app.deliv_task_sync', 'off', true);
    RETURN NEW;
  END IF;

  SELECT id, estimated_minutes INTO _existing_task_id, _existing_estimated
  FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;
  _assignee := public.resolve_deliverable_assignee(NEW.id);
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;

  _task_deadline := COALESCE(NEW.scheduled_date, NEW.planned_end);

  PERFORM set_config('app.deliv_task_sync', 'on', true);

  IF _existing_task_id IS NULL THEN
    INSERT INTO public.tasks (
      name, status, priority, project_id, department,
      deadline, assigned_to, deliverable_id, estimated_minutes
    ) VALUES (
      NEW.name,
      CASE WHEN NEW.status IN ('concluido','entregue') THEN 'done' ELSE 'por_comecar' END,
      'media',
      NEW.project_id,
      _project_dept,
      _task_deadline,
      _assignee,
      NEW.id,
      NEW.estimated_minutes
    );
  ELSE
    UPDATE public.tasks
    SET name = NEW.name,
        deadline = _task_deadline,
        project_id = NEW.project_id,
        assigned_to = COALESCE(assigned_to, _assignee),
        estimated_minutes = COALESCE(_existing_estimated, NEW.estimated_minutes),
        status = CASE
          WHEN NEW.status IN ('concluido','entregue') THEN 'done'
          WHEN status IN ('done','concluida') AND NEW.status NOT IN ('concluido','entregue') THEN 'por_comecar'
          ELSE status
        END,
        updated_at = now()
    WHERE id = _existing_task_id;
  END IF;

  PERFORM set_config('app.deliv_task_sync', 'off', true);
  RETURN NEW;
END;
$function$;