-- Phase 14: limpar referências ao status 'entregue' que não existe em DELIVERABLE_STATUSES
-- (canonical: pendente, em_progresso, aguarda_cliente, concluido)

CREATE OR REPLACE FUNCTION public.sync_task_status_to_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deliverable_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'done' THEN
    UPDATE public.project_deliverables
    SET status = 'concluido', updated_at = now()
    WHERE id = NEW.deliverable_id AND status <> 'concluido';
  ELSIF NEW.status = 'aguarda_feedback' THEN
    UPDATE public.project_deliverables
    SET status = 'aguarda_cliente', updated_at = now()
    WHERE id = NEW.deliverable_id AND status <> 'concluido';
  ELSIF OLD.status IN ('done','aguarda_feedback') THEN
    UPDATE public.project_deliverables
    SET status = 'pendente', updated_at = now()
    WHERE id = NEW.deliverable_id AND status <> 'concluido';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.backfill_deliverable_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _count integer := 0;
  _rec record;
  _assignee uuid;
  _project_dept text;
BEGIN
  FOR _rec IN
    SELECT pd.id, pd.name, pd.project_id, pd.status, pd.planned_end
    FROM public.project_deliverables pd
    LEFT JOIN public.tasks t ON t.deliverable_id = pd.id
    WHERE pd.responsible_type = 'equipa'
      AND COALESCE(pd.is_meeting, false) = false
      AND t.id IS NULL
  LOOP
    _assignee := public.resolve_deliverable_assignee(_rec.id);
    SELECT department INTO _project_dept FROM public.projects WHERE id = _rec.project_id;

    INSERT INTO public.tasks (
      name, status, priority, project_id, department,
      deadline, assigned_to, deliverable_id
    ) VALUES (
      _rec.name,
      CASE WHEN _rec.status = 'concluido' THEN 'done' ELSE 'por_comecar' END,
      'media',
      _rec.project_id,
      _project_dept,
      _rec.planned_end,
      _assignee,
      _rec.id
    );
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$function$;