-- Função idempotente de backfill: cria tarefas em falta para entregas equipa não-reunião
CREATE OR REPLACE FUNCTION public.backfill_deliverable_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      CASE WHEN _rec.status IN ('concluido','entregue') THEN 'done' ELSE 'por_comecar' END,
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
$$;

-- Executar backfill agora
SELECT public.backfill_deliverable_tasks();

-- Garantir que o trigger sync_deliverable_to_task também dispara em mudanças de is_meeting
-- (caso uma entrega passe de reunião para tarefa normal)
DROP TRIGGER IF EXISTS trg_sync_deliverable_to_task ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliverable_to_task
AFTER INSERT OR UPDATE OF name, planned_end, status, responsible_type, responsible_role, assigned_to, project_id, is_meeting
ON public.project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.sync_deliverable_to_task();