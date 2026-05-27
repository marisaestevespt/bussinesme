-- Make sync_deliverable_to_task consider `deadline` (the column the UI actually writes).
CREATE OR REPLACE FUNCTION public.sync_deliverable_to_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existing_task_id uuid;
  _existing_estimated integer;
  _existing_status text;
  _assignee uuid;
  _project_dept text;
  _task_deadline date;
  _new_task_status text;
BEGIN
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

  SELECT id, estimated_minutes, status
    INTO _existing_task_id, _existing_estimated, _existing_status
    FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;

  _assignee := public.resolve_deliverable_assignee(NEW.id);
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;

  -- `deadline` is the canonical column the UI writes to; fall back to legacy fields.
  _task_deadline := COALESCE(NEW.deadline, NEW.scheduled_date, NEW.planned_end);

  _new_task_status := CASE NEW.status
    WHEN 'concluido'       THEN 'done'
    WHEN 'concluida'       THEN 'done'
    WHEN 'entregue'        THEN 'done'
    WHEN 'aguarda_cliente' THEN 'aguarda_feedback'
    WHEN 'em_progresso'    THEN
      CASE WHEN _existing_status IN ('a_fazer','para_aprovacao','precisa_alteracoes')
           THEN _existing_status ELSE 'a_fazer' END
    WHEN 'em_curso'        THEN
      CASE WHEN _existing_status IN ('a_fazer','para_aprovacao','precisa_alteracoes')
           THEN _existing_status ELSE 'a_fazer' END
    WHEN 'pendente'        THEN 'por_comecar'
    ELSE COALESCE(_existing_status, 'por_comecar')
  END;

  PERFORM set_config('app.deliv_task_sync', 'on', true);

  IF _existing_task_id IS NULL THEN
    INSERT INTO public.tasks (
      name, status, priority, project_id, department,
      deadline, assigned_to, deliverable_id, estimated_minutes
    ) VALUES (
      NEW.name, _new_task_status, 'media',
      NEW.project_id, _project_dept,
      _task_deadline, _assignee, NEW.id, NEW.estimated_minutes
    );
  ELSE
    UPDATE public.tasks
    SET name = NEW.name,
        deadline = _task_deadline,
        project_id = NEW.project_id,
        assigned_to = COALESCE(assigned_to, _assignee),
        estimated_minutes = COALESCE(_existing_estimated, NEW.estimated_minutes),
        status = _new_task_status,
        updated_at = now()
    WHERE id = _existing_task_id;
  END IF;

  PERFORM set_config('app.deliv_task_sync', 'off', true);
  RETURN NEW;
END;
$function$;

-- Reverse trigger: when task changes, write to `deadline` (canonical) AND `scheduled_date`.
CREATE OR REPLACE FUNCTION public.sync_task_to_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_deliv_status text;
  _status_changed boolean;
  _deadline_changed boolean;
  _name_changed boolean;
BEGIN
  IF NEW.deliverable_id IS NULL THEN RETURN NEW; END IF;

  IF current_setting('app.deliv_task_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  _status_changed := NEW.status IS DISTINCT FROM OLD.status;
  _deadline_changed := NEW.deadline IS DISTINCT FROM OLD.deadline;
  _name_changed := NEW.name IS DISTINCT FROM OLD.name;

  IF NOT (_status_changed OR _deadline_changed OR _name_changed) THEN
    RETURN NEW;
  END IF;

  IF _status_changed THEN
    _new_deliv_status := CASE
      WHEN NEW.status = 'done'              THEN 'concluido'
      WHEN NEW.status = 'aguarda_feedback'  THEN 'aguarda_cliente'
      WHEN NEW.status = 'por_comecar'       THEN 'pendente'
      WHEN NEW.status IN ('a_fazer','para_aprovacao','precisa_alteracoes') THEN 'em_progresso'
      ELSE NULL
    END;
  END IF;

  PERFORM set_config('app.deliv_task_sync', 'on', true);
  UPDATE public.project_deliverables
    SET status = COALESCE(_new_deliv_status, status),
        deadline = CASE WHEN _deadline_changed THEN NEW.deadline ELSE deadline END,
        scheduled_date = CASE WHEN _deadline_changed THEN NEW.deadline ELSE scheduled_date END,
        name = CASE WHEN _name_changed THEN NEW.name ELSE name END,
        updated_at = now()
    WHERE id = NEW.deliverable_id;
  PERFORM set_config('app.deliv_task_sync', 'off', true);

  RETURN NEW;
END;
$function$;