-- Reattach missing trigger that syncs project_deliverables → tasks
DROP TRIGGER IF EXISTS trg_sync_deliverable_to_task ON public.project_deliverables;

CREATE TRIGGER trg_sync_deliverable_to_task
AFTER INSERT OR UPDATE OF name, status, planned_end, responsible_type, is_meeting, assigned_to, estimated_minutes
ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.sync_deliverable_to_task();

-- Backfill: any deliverable currently 'concluido'/'entregue' whose linked task isn't done → mark task done
UPDATE public.tasks t
SET status = 'done', updated_at = now()
FROM public.project_deliverables pd
WHERE t.deliverable_id = pd.id
  AND pd.status IN ('concluido','entregue')
  AND t.status NOT IN ('done','concluida');

-- Reverse backfill: deliverable not done but task done → mark deliverable concluido
UPDATE public.project_deliverables pd
SET status = 'concluido', updated_at = now()
FROM public.tasks t
WHERE t.deliverable_id = pd.id
  AND t.status IN ('done','concluida')
  AND pd.status NOT IN ('concluido','entregue');