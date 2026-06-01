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
  _existing_assigned uuid;
  _assignee uuid;
  _project_dept text;
  _task_deadline date;
  _new_task_status text;
  _assignee_changed boolean;
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

  SELECT id, estimated_minutes, status, assigned_to
    INTO _existing_task_id, _existing_estimated, _existing_status, _existing_assigned
    FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;

  _assignee := public.resolve_deliverable_assignee(NEW.id);
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;
  -- "Data para fazer" é a fonte oficial; deadline é apenas controlo interno
  _task_deadline := COALESCE(NEW.scheduled_date, NEW.planned_end);

  _assignee_changed := TG_OP = 'UPDATE'
    AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to;

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
        assigned_to = CASE
          WHEN _assignee_changed THEN NEW.assigned_to
          ELSE COALESCE(_existing_assigned, _assignee)
        END,
        estimated_minutes = COALESCE(_existing_estimated, NEW.estimated_minutes),
        status = _new_task_status,
        updated_at = now()
    WHERE id = _existing_task_id;
  END IF;

  PERFORM set_config('app.deliv_task_sync', 'off', true);
  RETURN NEW;
END;
$function$;

-- Trigger column list: deadline já não precisa de estar aqui (não sincroniza)
DROP TRIGGER IF EXISTS trg_sync_deliverable_to_task ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliverable_to_task
AFTER INSERT OR UPDATE OF
  name, status, planned_end, scheduled_date,
  responsible_type, is_meeting, assigned_to, estimated_minutes, deliverable_type
ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.sync_deliverable_to_task();

-- Backfill: tasks.deadline passa a refletir scheduled_date (não deadline)
UPDATE public.tasks t
SET deadline = COALESCE(d.scheduled_date, d.planned_end),
    updated_at = now()
FROM public.project_deliverables d
WHERE t.deliverable_id = d.id
  AND t.deadline IS DISTINCT FROM COALESCE(d.scheduled_date, d.planned_end);