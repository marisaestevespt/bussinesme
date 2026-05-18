-- Task → Deliverable: cobrir TODOS os estados de task
CREATE OR REPLACE FUNCTION public.sync_task_status_to_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_deliv_status text;
BEGIN
  IF NEW.deliverable_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  -- Anti-loop
  IF current_setting('app.deliv_task_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Mapeamento canónico task → deliverable
  _new_deliv_status := CASE
    WHEN NEW.status = 'done'              THEN 'concluido'
    WHEN NEW.status = 'aguarda_feedback'  THEN 'aguarda_cliente'
    WHEN NEW.status = 'por_comecar'       THEN 'pendente'
    WHEN NEW.status IN ('a_fazer','para_aprovacao','precisa_alteracoes') THEN 'em_progresso'
    ELSE NULL
  END;

  IF _new_deliv_status IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.deliv_task_sync', 'on', true);
  UPDATE public.project_deliverables
    SET status = _new_deliv_status, updated_at = now()
    WHERE id = NEW.deliverable_id AND status IS DISTINCT FROM _new_deliv_status;
  PERFORM set_config('app.deliv_task_sync', 'off', true);

  RETURN NEW;
END;
$function$;

-- Deliverable → Task: respeitar em_progresso / aguarda_cliente
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
  _task_deadline := COALESCE(NEW.scheduled_date, NEW.planned_end);

  -- Mapeamento deliverable → task (preserva sub-estados quando compatível)
  _new_task_status := CASE NEW.status
    WHEN 'concluido'       THEN 'done'
    WHEN 'concluida'       THEN 'done'
    WHEN 'entregue'        THEN 'done'
    WHEN 'aguarda_cliente' THEN 'aguarda_feedback'
    WHEN 'em_progresso'    THEN
      CASE
        WHEN _existing_status IN ('a_fazer','para_aprovacao','precisa_alteracoes') THEN _existing_status
        ELSE 'a_fazer'
      END
    WHEN 'em_curso'        THEN
      CASE
        WHEN _existing_status IN ('a_fazer','para_aprovacao','precisa_alteracoes') THEN _existing_status
        ELSE 'a_fazer'
      END
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