-- 1. Stop syncing offset/duration from product templates to project deliverables on INSERT
--    (UPDATE path can stay synced for legacy but new project_deliverables won't get them)
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
      responsible_type = COALESCE(NEW.responsible_type, 'equipa'),
      responsible_role = NEW.responsible_role,
      deliverable_type = COALESCE(NEW.deliverable_type, 'tarefa')
    WHERE source_template_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.phase_id IS NOT NULL THEN
      INSERT INTO public.project_deliverables (
        project_id, phase_id, name, description, sort_order, linked_sop_id,
        source_template_id, status, portal_visible, is_recurring,
        responsible_type, responsible_role, deliverable_type
      )
      SELECT pp.project_id, pp.id, NEW.name, NEW.description, NEW.sort_order, NEW.linked_sop_id,
             NEW.id, 'pendente',
             COALESCE(NEW.portal_visible, true), COALESCE(NEW.is_recurring, false),
             COALESCE(NEW.responsible_type, 'equipa'), NEW.responsible_role,
             COALESCE(NEW.deliverable_type, 'tarefa')
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

-- 2. Drop the trigger that auto-creates tasks on every deliverable insert/update
--    (Function kept around in case anything else references it.)
DROP TRIGGER IF EXISTS trg_sync_deliverable_to_task ON public.project_deliverables;

-- 3. RPC: apply deliverables -> create tasks for entregas com data definida, sem tarefa
CREATE OR REPLACE FUNCTION public.apply_project_deliverable_tasks(_project_id uuid)
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
  SELECT department INTO _project_dept FROM public.projects WHERE id = _project_id;

  FOR _rec IN
    SELECT pd.id, pd.name, pd.status, pd.planned_end
    FROM public.project_deliverables pd
    LEFT JOIN public.tasks t ON t.deliverable_id = pd.id
    WHERE pd.project_id = _project_id
      AND COALESCE(pd.responsible_type, 'equipa') = 'equipa'
      AND COALESCE(pd.is_meeting, false) = false
      AND COALESCE(pd.deliverable_type, 'tarefa') <> 'reuniao'
      AND pd.planned_end IS NOT NULL
      AND t.id IS NULL
  LOOP
    _assignee := public.resolve_deliverable_assignee(_rec.id);

    INSERT INTO public.tasks (
      name, status, priority, project_id, department,
      deadline, assigned_to, deliverable_id
    ) VALUES (
      _rec.name,
      CASE WHEN _rec.status IN ('concluido','entregue') THEN 'done' ELSE 'por_comecar' END,
      'media',
      _project_id,
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