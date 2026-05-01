ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS estimated_project_hours numeric;

CREATE OR REPLACE FUNCTION public.set_project_budget_from_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _monthly_hours numeric;
  _project_hours numeric;
BEGIN
  IF NEW.budgeted_minutes IS NOT NULL OR NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT monthly_hours_per_client, estimated_project_hours
  INTO _monthly_hours, _project_hours
  FROM public.products
  WHERE id = NEW.product_id;

  IF NEW.type = 'cliente_servico_mensal' OR NEW.project_mode = 'recorrente' THEN
    IF _monthly_hours IS NOT NULL AND _monthly_hours > 0 THEN
      NEW.budgeted_minutes := ROUND(_monthly_hours * 60)::integer;
    END IF;
  ELSIF _project_hours IS NOT NULL AND _project_hours > 0 THEN
    NEW.budgeted_minutes := ROUND(_project_hours * 60)::integer;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_project_budget_from_product ON public.projects;
CREATE TRIGGER trg_set_project_budget_from_product
BEFORE INSERT OR UPDATE OF product_id, type, project_mode, budgeted_minutes
ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_budget_from_product();

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
     OR COALESCE(NEW.responsible_type, 'equipa') <> 'equipa'
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

DROP TRIGGER IF EXISTS trg_sync_deliverable_to_task ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliverable_to_task
AFTER INSERT OR UPDATE OF name, status, planned_end, scheduled_date, responsible_type, is_meeting, assigned_to, estimated_minutes, deliverable_type
ON public.project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.sync_deliverable_to_task();

CREATE OR REPLACE FUNCTION public.suggest_task_estimate(
  _name text,
  _sop_id uuid DEFAULT NULL,
  _project_id uuid DEFAULT NULL,
  _deliverable_template_id uuid DEFAULT NULL
)
RETURNS TABLE(
  avg_minutes integer,
  sample_count integer,
  matched_task_name text,
  confidence text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH context_project AS (
    SELECT product_id
    FROM public.projects
    WHERE id = _project_id
  ),
  input AS (
    SELECT
      lower(regexp_replace(translate(coalesce(_name, ''), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g')) AS normalized_name,
      (SELECT product_id FROM context_project) AS product_id
  ),
  task_actuals AS (
    SELECT
      t.id,
      t.name,
      t.sop_id,
      t.project_id,
      p.product_id,
      lower(regexp_replace(translate(t.name, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g')) AS normalized_task_name,
      SUM(tte.duration_minutes)::integer AS actual_minutes
    FROM public.tasks t
    JOIN public.task_time_entries tte ON tte.task_id = t.id
    LEFT JOIN public.projects p ON p.id = t.project_id
    WHERE tte.duration_minutes > 0
      AND (tte.ended_at IS NOT NULL OR tte.is_manual = true)
      AND coalesce(t.name, '') <> ''
    GROUP BY t.id, t.name, t.sop_id, t.project_id, p.product_id
  ),
  scored AS (
    SELECT
      ta.*,
      CASE
        WHEN _sop_id IS NOT NULL AND ta.sop_id = _sop_id THEN 100
        WHEN input.product_id IS NOT NULL AND ta.product_id = input.product_id AND ta.normalized_task_name = input.normalized_name THEN 90
        WHEN ta.normalized_task_name = input.normalized_name THEN 80
        WHEN length(input.normalized_name) >= 4 AND (ta.normalized_task_name LIKE '%' || input.normalized_name || '%' OR input.normalized_name LIKE '%' || ta.normalized_task_name || '%') THEN 60
        ELSE 0
      END AS score
    FROM task_actuals ta
    CROSS JOIN input
  ),
  matches AS (
    SELECT * FROM scored WHERE score >= 60
  )
  SELECT
    ROUND(AVG(actual_minutes))::integer AS avg_minutes,
    COUNT(*)::integer AS sample_count,
    (ARRAY_AGG(name ORDER BY score DESC, actual_minutes DESC))[1] AS matched_task_name,
    CASE
      WHEN MAX(score) >= 90 AND COUNT(*) >= 2 THEN 'alta'
      WHEN MAX(score) >= 80 THEN 'média'
      ELSE 'baixa'
    END AS confidence
  FROM matches
  HAVING COUNT(*) > 0;
$function$;