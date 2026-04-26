-- 1. Add estimated_minutes to product_deliverable_templates
ALTER TABLE public.product_deliverable_templates
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

-- 2. Add estimated_minutes to project_deliverables
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

-- 3. Add estimated_minutes to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

-- 4. Add budgeted_minutes to projects (frozen budget snapshot)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budgeted_minutes integer;

-- 5. Update sync_deliverable_to_task to propagate estimated_minutes
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
BEGIN
  IF COALESCE(NEW.is_meeting, false) = true OR COALESCE(NEW.responsible_type, 'equipa') <> 'equipa' THEN
    DELETE FROM public.tasks WHERE deliverable_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id, estimated_minutes INTO _existing_task_id, _existing_estimated
  FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;
  _assignee := public.resolve_deliverable_assignee(NEW.id);
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;

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
      NEW.planned_end,
      _assignee,
      NEW.id,
      NEW.estimated_minutes
    );
  ELSE
    UPDATE public.tasks
    SET name = NEW.name,
        deadline = NEW.planned_end,
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

-- 6. Update sync_product_phase_to_projects to also handle estimated_minutes when product deliverables propagate
-- (deliverables are propagated separately; we don't change phase sync here)

-- 7. Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_estimated
  ON public.tasks (deliverable_id) WHERE estimated_minutes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_deliverables_estimated
  ON public.project_deliverables (project_id) WHERE estimated_minutes IS NOT NULL;