
-- 1. Schema additions
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.product_deliverable_templates ADD COLUMN IF NOT EXISTS responsible_role text;
ALTER TABLE public.project_deliverables ADD COLUMN IF NOT EXISTS responsible_role text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deliverable_id uuid;
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_id ON public.tasks(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_role ON public.project_members(project_id, role);

-- 2. Resolve assignee for a deliverable
CREATE OR REPLACE FUNCTION public.resolve_deliverable_assignee(_deliverable_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id uuid;
  _role text;
  _explicit uuid;
  _assignee uuid;
  _member_count int;
BEGIN
  SELECT project_id, responsible_role, assigned_to
  INTO _project_id, _role, _explicit
  FROM public.project_deliverables
  WHERE id = _deliverable_id;

  IF _explicit IS NOT NULL THEN
    RETURN _explicit;
  END IF;

  -- 1. Match by role
  IF _role IS NOT NULL THEN
    SELECT pm.profile_id INTO _assignee
    FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.role = _role
    LIMIT 1;
    IF _assignee IS NOT NULL THEN RETURN _assignee; END IF;
  END IF;

  -- 2. Single project member
  SELECT count(*) INTO _member_count
  FROM public.project_members WHERE project_id = _project_id;
  IF _member_count = 1 THEN
    SELECT profile_id INTO _assignee
    FROM public.project_members WHERE project_id = _project_id LIMIT 1;
    RETURN _assignee;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Trigger: deliverable INSERT/UPDATE → manage linked task
CREATE OR REPLACE FUNCTION public.sync_deliverable_to_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_task_id uuid;
  _assignee uuid;
  _phase_dept text;
  _project_dept text;
  _new_task_id uuid;
BEGIN
  -- Only manage tasks for team-responsible deliverables
  IF COALESCE(NEW.responsible_type, 'equipa') <> 'equipa' THEN
    -- If switched away from equipa, delete linked task
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.tasks WHERE deliverable_id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;

  SELECT id INTO _existing_task_id FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;
  _assignee := public.resolve_deliverable_assignee(NEW.id);

  -- Resolve department from phase or project
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;
  _phase_dept := _project_dept;

  IF _existing_task_id IS NULL THEN
    INSERT INTO public.tasks (
      name, status, priority, project_id, department,
      deadline, assigned_to, deliverable_id
    ) VALUES (
      NEW.name,
      CASE WHEN NEW.status IN ('concluido','entregue') THEN 'concluida' ELSE 'pendente' END,
      'media',
      NEW.project_id,
      _phase_dept,
      NEW.planned_end,
      _assignee,
      NEW.id
    );
  ELSE
    UPDATE public.tasks SET
      name = NEW.name,
      deadline = NEW.planned_end,
      project_id = NEW.project_id,
      assigned_to = COALESCE(assigned_to, _assignee),
      status = CASE
        WHEN NEW.status IN ('concluido','entregue') THEN 'concluida'
        WHEN status = 'concluida' AND NEW.status NOT IN ('concluido','entregue') THEN 'pendente'
        ELSE status
      END,
      updated_at = now()
    WHERE id = _existing_task_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deliverable_to_task ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliverable_to_task
AFTER INSERT OR UPDATE OF name, planned_end, status, responsible_type, responsible_role, assigned_to, project_id
ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.sync_deliverable_to_task();

-- 4. Trigger: deliverable DELETE → remove task
CREATE OR REPLACE FUNCTION public.cleanup_task_on_deliverable_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.tasks WHERE deliverable_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_task_on_deliverable_delete ON public.project_deliverables;
CREATE TRIGGER trg_cleanup_task_on_deliverable_delete
BEFORE DELETE ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_task_on_deliverable_delete();

-- 5. Trigger: task → deliverable status sync (reverse)
CREATE OR REPLACE FUNCTION public.sync_task_status_to_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deliverable_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'concluida' THEN
    UPDATE public.project_deliverables
    SET status = 'concluido', updated_at = now()
    WHERE id = NEW.deliverable_id AND status NOT IN ('concluido','entregue');
  ELSIF OLD.status = 'concluida' THEN
    UPDATE public.project_deliverables
    SET status = 'pendente', updated_at = now()
    WHERE id = NEW.deliverable_id AND status IN ('concluido','entregue');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_status_to_deliverable ON public.tasks;
CREATE TRIGGER trg_sync_task_status_to_deliverable
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_status_to_deliverable();

-- 6. Sync template responsible_role → project deliverables (extend existing trigger logic)
CREATE OR REPLACE FUNCTION public.sync_product_deliverable_to_projects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.project_deliverables SET
      name = NEW.name,
      description = NEW.description,
      sort_order = NEW.sort_order,
      linked_sop_id = NEW.linked_sop_id,
      portal_visible = COALESCE(NEW.portal_visible, true),
      is_recurring = COALESCE(NEW.is_recurring, false),
      duration_days = NEW.duration_days,
      duration_unit = COALESCE(NEW.duration_unit, 'dias_uteis'),
      offset_days = COALESCE(NEW.offset_days, 0),
      offset_trigger = COALESCE(NEW.offset_trigger, 'inicio_fase'),
      responsible_type = COALESCE(NEW.responsible_type, 'equipa'),
      responsible_role = NEW.responsible_role
    WHERE source_template_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.phase_id IS NOT NULL THEN
      INSERT INTO public.project_deliverables (project_id, phase_id, name, description, sort_order, linked_sop_id, source_template_id, status, portal_visible, is_recurring, duration_days, duration_unit, offset_days, offset_trigger, responsible_type, responsible_role)
      SELECT pp.project_id, pp.id, NEW.name, NEW.description, NEW.sort_order, NEW.linked_sop_id, NEW.id, 'pendente',
             COALESCE(NEW.portal_visible, true), COALESCE(NEW.is_recurring, false),
             NEW.duration_days, COALESCE(NEW.duration_unit, 'dias_uteis'), COALESCE(NEW.offset_days, 0), COALESCE(NEW.offset_trigger, 'inicio_fase'),
             COALESCE(NEW.responsible_type, 'equipa'), NEW.responsible_role
      FROM public.project_phases pp
      JOIN public.projects p ON p.id = pp.project_id
      WHERE pp.source_phase_id = NEW.phase_id
        AND p.status NOT IN ('concluido', 'cancelado');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.project_deliverables WHERE source_template_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7. Backfill: gerar tarefas para entregas existentes pendentes sem tarefa
INSERT INTO public.tasks (name, status, priority, project_id, department, deadline, assigned_to, deliverable_id)
SELECT
  pd.name,
  CASE WHEN pd.status IN ('concluido','entregue') THEN 'concluida' ELSE 'pendente' END,
  'media',
  pd.project_id,
  p.department,
  pd.planned_end,
  public.resolve_deliverable_assignee(pd.id),
  pd.id
FROM public.project_deliverables pd
JOIN public.projects p ON p.id = pd.project_id
WHERE COALESCE(pd.responsible_type, 'equipa') = 'equipa'
  AND pd.planned_end IS NOT NULL
  AND p.status NOT IN ('concluido','cancelado')
  AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.deliverable_id = pd.id);
