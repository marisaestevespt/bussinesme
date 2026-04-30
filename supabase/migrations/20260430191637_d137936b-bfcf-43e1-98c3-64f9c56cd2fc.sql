-- 1) Novo campo scheduled_date (data para fazer)
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS scheduled_date date;

-- 2) Atualizar trigger sync_deliverable_to_task para usar scheduled_date como deadline da tarefa
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
  IF COALESCE(NEW.is_meeting, false) = true OR COALESCE(NEW.responsible_type, 'equipa') <> 'equipa' THEN
    DELETE FROM public.tasks WHERE deliverable_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id, estimated_minutes INTO _existing_task_id, _existing_estimated
  FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;
  _assignee := public.resolve_deliverable_assignee(NEW.id);
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;

  -- Prefer scheduled_date (data para fazer); fallback to planned_end (deadline)
  _task_deadline := COALESCE(NEW.scheduled_date, NEW.planned_end);

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

  RETURN NEW;
END;
$function$;

-- 3) Trigger de aviso quando scheduled_date ultrapassa a deadline
CREATE OR REPLACE FUNCTION public.notify_deliverable_schedule_overrun()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _project_name text;
  _assignee uuid;
  _owner_id uuid;
  _msg text;
  _link text;
BEGIN
  -- Só dispara se houver ambas as datas e scheduled > deadline
  IF NEW.scheduled_date IS NULL OR NEW.planned_end IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.scheduled_date <= NEW.planned_end THEN
    RETURN NEW;
  END IF;
  -- Em UPDATE: só notificar se a scheduled_date mudou (ou se a deadline mudou e agora é violada)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.scheduled_date IS NOT DISTINCT FROM OLD.scheduled_date
       AND NEW.planned_end IS NOT DISTINCT FROM OLD.planned_end THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;
  _assignee := public.resolve_deliverable_assignee(NEW.id);
  _link := '/hub/projetos/' || NEW.project_id::text;
  _msg := 'A entrega "' || NEW.name || '" no projeto "' || COALESCE(_project_name, 'projeto') ||
          '" foi planeada para ' || to_char(NEW.scheduled_date, 'DD/MM') ||
          ', depois da deadline (' || to_char(NEW.planned_end, 'DD/MM') || ').';

  -- Notificar responsável da entrega
  IF _assignee IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (_assignee, 'warning', 'Data de execução ultrapassa deadline', _msg, _link);
  END IF;

  -- Notificar todos os Owners
  FOR _owner_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'owner'
  LOOP
    IF _owner_id IS DISTINCT FROM _assignee THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (_owner_id, 'warning', 'Data de execução ultrapassa deadline', _msg, _link);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_deliverable_schedule_overrun ON public.project_deliverables;
CREATE TRIGGER trg_notify_deliverable_schedule_overrun
AFTER INSERT OR UPDATE OF scheduled_date, planned_end ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.notify_deliverable_schedule_overrun();