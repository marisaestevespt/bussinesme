-- Treat responsible_type='ambos' as both team-internal (creates task) and client-visible (portal)

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
  IF COALESCE(NEW.is_meeting, false) = true
     OR COALESCE(NEW.responsible_type, 'equipa') NOT IN ('equipa','ambos')
     OR NEW.deliverable_type IN ('reuniao', 'link', 'documento', 'aprovacao') THEN
    DELETE FROM public.tasks WHERE deliverable_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id, estimated_minutes INTO _existing_task_id, _existing_estimated
  FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;
  _assignee := public.resolve_deliverable_assignee(NEW.id);
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;

  _task_deadline := COALESCE(NEW.scheduled_date, NEW.planned_end);

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

  RETURN NEW;
END;
$function$;

-- Auto-assign also for 'ambos'
CREATE OR REPLACE FUNCTION public.auto_assign_deliverable_by_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee uuid;
BEGIN
  IF NEW.assigned_to IS NOT NULL
     OR COALESCE(NEW.responsible_type, 'equipa') NOT IN ('equipa','ambos')
     OR NEW.responsible_role IS NULL
     OR NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pm.profile_id
    INTO v_assignee
  FROM public.project_members pm
  JOIN public.team_members tm ON tm.profile_id = pm.profile_id
  WHERE pm.project_id = NEW.project_id
    AND tm.status = 'ativo'
    AND tm.work_areas ? NEW.responsible_role
  ORDER BY (
    SELECT COUNT(*)
    FROM public.project_deliverables pd
    WHERE pd.project_id = NEW.project_id
      AND pd.assigned_to = pm.profile_id
  ) ASC, pm.profile_id ASC
  LIMIT 1;

  IF v_assignee IS NOT NULL THEN
    NEW.assigned_to := v_assignee;
  END IF;

  RETURN NEW;
END;
$$;