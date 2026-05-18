-- Fase C-3: Anti-loop guard + reconciliação para sync Entregas↔Tarefas
-- Usa GUC de sessão (app.deliv_task_sync) para impedir re-entrada cruzada entre
-- sync_deliverable_to_task e sync_task_status_to_deliverable.

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
      deadline, assigned_to, deliverable_id, estimated_minutes, estimated_time
    ) VALUES (
      NEW.name,
      CASE WHEN NEW.status IN ('concluido','entregue') THEN 'done' ELSE 'por_comecar' END,
      'media',
      NEW.project_id,
      _project_dept,
      _task_deadline,
      _assignee,
      NEW.id,
      NEW.estimated_minutes,
      CASE WHEN NEW.estimated_minutes IS NOT NULL THEN ROUND((NEW.estimated_minutes::numeric / 60), 2) ELSE NULL END
    );
  ELSE
    UPDATE public.tasks
    SET name = NEW.name,
        deadline = _task_deadline,
        project_id = NEW.project_id,
        assigned_to = COALESCE(assigned_to, _assignee),
        estimated_minutes = COALESCE(_existing_estimated, NEW.estimated_minutes),
        estimated_time = COALESCE(estimated_time, CASE WHEN COALESCE(_existing_estimated, NEW.estimated_minutes) IS NOT NULL THEN ROUND((COALESCE(_existing_estimated, NEW.estimated_minutes)::numeric / 60), 2) ELSE NULL END),
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

CREATE OR REPLACE FUNCTION public.sync_task_status_to_deliverable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deliverable_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Anti-loop: se já estamos a propagar de deliverable→task, não reentrar
  IF current_setting('app.deliv_task_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.deliv_task_sync', 'on', true);

  IF NEW.status = 'done' THEN
    UPDATE public.project_deliverables
    SET status = 'concluido', updated_at = now()
    WHERE id = NEW.deliverable_id AND status <> 'concluido';
  ELSIF NEW.status = 'aguarda_feedback' THEN
    UPDATE public.project_deliverables
    SET status = 'aguarda_cliente', updated_at = now()
    WHERE id = NEW.deliverable_id AND status <> 'aguarda_cliente' AND status <> 'concluido';
  ELSIF OLD.status IN ('done','aguarda_feedback') THEN
    UPDATE public.project_deliverables
    SET status = 'pendente', updated_at = now()
    WHERE id = NEW.deliverable_id AND status NOT IN ('pendente','concluido');
  END IF;

  PERFORM set_config('app.deliv_task_sync', 'off', true);

  RETURN NEW;
END;
$function$;

-- Reconciliação: encontra divergências e devolve relatório/correções
CREATE OR REPLACE FUNCTION public.reconcile_deliverable_tasks(_apply boolean DEFAULT false)
 RETURNS TABLE(
   deliverable_id uuid,
   task_id uuid,
   deliverable_name text,
   deliverable_status text,
   task_status text,
   issue text,
   fixed boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rec record;
  _fixed boolean;
BEGIN
  -- 1. Entregas equipa sem task associada (devia existir)
  FOR _rec IN
    SELECT pd.id AS d_id, pd.name, pd.status AS d_status
    FROM public.project_deliverables pd
    LEFT JOIN public.tasks t ON t.deliverable_id = pd.id
    WHERE COALESCE(pd.responsible_type, 'equipa') IN ('equipa','ambos')
      AND COALESCE(pd.is_meeting, false) = false
      AND COALESCE(pd.deliverable_type, 'tarefa') NOT IN ('reuniao','link','documento','aprovacao')
      AND t.id IS NULL
  LOOP
    _fixed := false;
    IF _apply THEN
      PERFORM public.apply_project_deliverable_tasks((SELECT project_id FROM public.project_deliverables WHERE id = _rec.d_id));
      _fixed := true;
    END IF;
    RETURN QUERY SELECT _rec.d_id, NULL::uuid, _rec.name, _rec.d_status, NULL::text, 'missing_task'::text, _fixed;
  END LOOP;

  -- 2. Tasks órfãs (deliverable_id aponta para entrega inexistente)
  FOR _rec IN
    SELECT t.id AS t_id, t.name, t.status AS t_status, t.deliverable_id AS d_id
    FROM public.tasks t
    LEFT JOIN public.project_deliverables pd ON pd.id = t.deliverable_id
    WHERE t.deliverable_id IS NOT NULL AND pd.id IS NULL
  LOOP
    _fixed := false;
    IF _apply THEN
      UPDATE public.tasks SET deliverable_id = NULL WHERE id = _rec.t_id;
      _fixed := true;
    END IF;
    RETURN QUERY SELECT NULL::uuid, _rec.t_id, _rec.name, NULL::text, _rec.t_status, 'orphan_task'::text, _fixed;
  END LOOP;

  -- 3. Status divergentes (entrega concluido mas task não-done, ou vice-versa)
  FOR _rec IN
    SELECT pd.id AS d_id, t.id AS t_id, pd.name, pd.status AS d_status, t.status AS t_status
    FROM public.project_deliverables pd
    JOIN public.tasks t ON t.deliverable_id = pd.id
    WHERE (pd.status IN ('concluido','entregue') AND t.status <> 'done')
       OR (t.status = 'done' AND pd.status NOT IN ('concluido','entregue'))
  LOOP
    _fixed := false;
    IF _apply THEN
      PERFORM set_config('app.deliv_task_sync', 'on', true);
      IF _rec.d_status IN ('concluido','entregue') THEN
        UPDATE public.tasks SET status = 'done', updated_at = now() WHERE id = _rec.t_id;
      ELSE
        UPDATE public.project_deliverables SET status = 'concluido', updated_at = now() WHERE id = _rec.d_id;
      END IF;
      PERFORM set_config('app.deliv_task_sync', 'off', true);
      _fixed := true;
    END IF;
    RETURN QUERY SELECT _rec.d_id, _rec.t_id, _rec.name, _rec.d_status, _rec.t_status, 'status_drift'::text, _fixed;
  END LOOP;
END;
$function$;

-- Só owners podem executar reconciliação
REVOKE ALL ON FUNCTION public.reconcile_deliverable_tasks(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_deliverable_tasks(boolean) TO authenticated;