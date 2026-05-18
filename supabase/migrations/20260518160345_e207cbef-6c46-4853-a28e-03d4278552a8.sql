CREATE OR REPLACE FUNCTION public.calculate_project_progress(_project_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _project record;
  _total integer := 0;
  _done integer := 0;
  _pct integer := 0;
BEGIN
  SELECT id, type, project_mode
  INTO _project
  FROM public.projects
  WHERE id = _project_id;

  IF _project.id IS NULL THEN
    RETURN 0;
  END IF;

  IF _project.type = 'cliente_servico_mensal' AND _project.project_mode = 'recorrente' THEN
    SELECT COUNT(*), COUNT(*) FILTER (
      WHERE pp.status IN ('concluida', 'concluido', 'completed', 'done')
    )
    INTO _total, _done
    FROM public.project_phases pp
    WHERE pp.project_id = _project_id;

    SELECT
      _total + COUNT(*),
      _done + COUNT(*) FILTER (WHERE pro.status = 'concluida')
    INTO _total, _done
    FROM public.project_recurring_occurrences pro
    WHERE pro.project_id = _project_id;

    SELECT
      _total + COUNT(*),
      _done + COUNT(*) FILTER (
        WHERE t.status IN ('done', 'concluida', 'concluído', 'concluido', 'completed')
      )
    INTO _total, _done
    FROM public.tasks t
    WHERE t.project_id = _project_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.project_recurring_occurrences pro
        WHERE pro.linked_task_id = t.id
      );

    IF _total > 0 THEN
      _pct := ROUND((_done::numeric / _total::numeric) * 100);
    END IF;

    RETURN LEAST(100, GREATEST(0, COALESCE(_pct, 0)));
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (
    WHERE pd.status IN ('concluido', 'concluida', 'entregue', 'completed', 'done')
  )
  INTO _total, _done
  FROM public.project_deliverables pd
  LEFT JOIN public.project_phases pp ON pp.id = pd.phase_id
  WHERE COALESCE(pd.project_id, pp.project_id) = _project_id;

  IF _total = 0 THEN
    SELECT COUNT(*), COUNT(*) FILTER (
      WHERE pp.status IN ('concluida', 'concluido', 'completed', 'done')
    )
    INTO _total, _done
    FROM public.project_phases pp
    WHERE pp.project_id = _project_id;
  END IF;

  IF _total > 0 THEN
    _pct := ROUND((_done::numeric / _total::numeric) * 100);
  END IF;

  RETURN LEAST(100, GREATEST(0, COALESCE(_pct, 0)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_project_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _project_ids uuid[] := ARRAY[]::uuid[];
  _project_id uuid;
  _phase_id uuid;
  _linked_task_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'project_deliverables' THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      _project_ids := array_append(_project_ids, NEW.project_id);
      _phase_id := NEW.phase_id;
      IF _phase_id IS NOT NULL THEN
        SELECT array_append(_project_ids, pp.project_id)
        INTO _project_ids
        FROM public.project_phases pp
        WHERE pp.id = _phase_id;
      END IF;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      _project_ids := array_append(_project_ids, OLD.project_id);
      _phase_id := OLD.phase_id;
      IF _phase_id IS NOT NULL THEN
        SELECT array_append(_project_ids, pp.project_id)
        INTO _project_ids
        FROM public.project_phases pp
        WHERE pp.id = _phase_id;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'project_phases' THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      _project_ids := array_append(_project_ids, NEW.project_id);
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      _project_ids := array_append(_project_ids, OLD.project_id);
    END IF;

  ELSIF TG_TABLE_NAME = 'project_recurring_occurrences' THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      _project_ids := array_append(_project_ids, NEW.project_id);
      _linked_task_id := NEW.linked_task_id;
      IF _linked_task_id IS NOT NULL THEN
        SELECT array_append(_project_ids, t.project_id)
        INTO _project_ids
        FROM public.tasks t
        WHERE t.id = _linked_task_id;
      END IF;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      _project_ids := array_append(_project_ids, OLD.project_id);
      _linked_task_id := OLD.linked_task_id;
      IF _linked_task_id IS NOT NULL THEN
        SELECT array_append(_project_ids, t.project_id)
        INTO _project_ids
        FROM public.tasks t
        WHERE t.id = _linked_task_id;
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'tasks' THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      _project_ids := array_append(_project_ids, NEW.project_id);
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      _project_ids := array_append(_project_ids, OLD.project_id);
    END IF;
  END IF;

  FOR _project_id IN
    SELECT DISTINCT pid
    FROM unnest(_project_ids) AS pid
    WHERE pid IS NOT NULL
  LOOP
    UPDATE public.projects
    SET progress = public.calculate_project_progress(_project_id)
    WHERE id = _project_id;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_project_progress_deliverables ON public.project_deliverables;
CREATE TRIGGER trg_update_project_progress_deliverables
AFTER INSERT OR UPDATE OR DELETE ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.update_project_progress();

DROP TRIGGER IF EXISTS trg_update_project_progress_phases ON public.project_phases;
CREATE TRIGGER trg_update_project_progress_phases
AFTER INSERT OR UPDATE OR DELETE ON public.project_phases
FOR EACH ROW
EXECUTE FUNCTION public.update_project_progress();

DROP TRIGGER IF EXISTS trg_update_project_progress_occurrences ON public.project_recurring_occurrences;
CREATE TRIGGER trg_update_project_progress_occurrences
AFTER INSERT OR UPDATE OR DELETE ON public.project_recurring_occurrences
FOR EACH ROW
EXECUTE FUNCTION public.update_project_progress();

DROP TRIGGER IF EXISTS trg_update_project_progress_tasks ON public.tasks;
CREATE TRIGGER trg_update_project_progress_tasks
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_project_progress();

UPDATE public.projects p
SET progress = public.calculate_project_progress(p.id)
WHERE p.archived_at IS NULL;