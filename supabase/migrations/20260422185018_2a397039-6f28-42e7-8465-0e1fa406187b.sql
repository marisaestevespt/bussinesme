-- 1. Adicionar coluna para marcar entregas que são "reunião" (fonte = tabela meetings)
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS is_meeting boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_deliverable_templates
  ADD COLUMN IF NOT EXISTS is_meeting boolean NOT NULL DEFAULT false;

-- 2. Marcar retroativamente entregas cujo nome sugere reunião/sessão
UPDATE public.project_deliverables
SET is_meeting = true
WHERE is_meeting = false
  AND (
    lower(name) LIKE '%reuni%'
    OR lower(name) LIKE '%sess%o%'
    OR lower(name) LIKE '%meeting%'
  );

UPDATE public.product_deliverable_templates
SET is_meeting = true
WHERE is_meeting = false
  AND (
    lower(name) LIKE '%reuni%'
    OR lower(name) LIKE '%sess%o%'
    OR lower(name) LIKE '%meeting%'
  );

-- 3. Atualizar trigger sync_deliverable_to_task para NÃO criar tarefa se is_meeting=true
CREATE OR REPLACE FUNCTION public.sync_deliverable_to_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existing_task_id uuid;
  _assignee uuid;
  _project_dept text;
BEGIN
  -- Se for entrega-reunião OU não for da equipa: garantir que NÃO existe tarefa
  IF COALESCE(NEW.is_meeting, false) = true OR COALESCE(NEW.responsible_type, 'equipa') <> 'equipa' THEN
    DELETE FROM public.tasks WHERE deliverable_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id INTO _existing_task_id FROM public.tasks WHERE deliverable_id = NEW.id LIMIT 1;
  _assignee := public.resolve_deliverable_assignee(NEW.id);
  SELECT department INTO _project_dept FROM public.projects WHERE id = NEW.project_id;

  IF _existing_task_id IS NULL THEN
    INSERT INTO public.tasks (
      name, status, priority, project_id, department,
      deadline, assigned_to, deliverable_id
    ) VALUES (
      NEW.name,
      CASE WHEN NEW.status IN ('concluido','entregue') THEN 'concluida' ELSE 'pendente' END,
      'media',
      NEW.project_id,
      _project_dept,
      NEW.planned_end,
      _assignee,
      NEW.id
    );
  ELSE
    UPDATE public.tasks
    SET name = NEW.name,
        deadline = NEW.planned_end,
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
$function$;

-- 4. Apagar tarefas já criadas para entregas-reunião (limpeza retroativa)
DELETE FROM public.tasks
WHERE deliverable_id IN (
  SELECT id FROM public.project_deliverables WHERE is_meeting = true
);

-- 5. Trigger: ao terminar/confirmar uma reunião, marcar entregas-reunião do mesmo projeto como concluídas
-- (matching por nome aproximado dentro do projeto)
CREATE OR REPLACE FUNCTION public.sync_meeting_to_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'terminada' AND (OLD.status IS DISTINCT FROM 'terminada') AND NEW.project_id IS NOT NULL THEN
    UPDATE public.project_deliverables
    SET status = 'concluido', updated_at = now()
    WHERE project_id = NEW.project_id
      AND is_meeting = true
      AND status NOT IN ('concluido','entregue')
      AND (
        lower(NEW.title) LIKE '%' || lower(name) || '%'
        OR lower(name) LIKE '%' || split_part(lower(NEW.title), '|', 1) || '%'
      );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_meeting_to_deliverable ON public.meetings;
CREATE TRIGGER trg_sync_meeting_to_deliverable
AFTER UPDATE OF status ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.sync_meeting_to_deliverable();