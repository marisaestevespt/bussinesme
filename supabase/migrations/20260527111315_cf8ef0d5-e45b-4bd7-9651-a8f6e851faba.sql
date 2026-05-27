-- Bidirectional date sync between tasks and project_deliverables.
-- Existing sync_task_status_to_deliverable only propagated status. Rename and extend
-- to also propagate task.deadline → deliverable.scheduled_date.

CREATE OR REPLACE FUNCTION public.sync_task_to_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_deliv_status text;
  _status_changed boolean;
  _deadline_changed boolean;
  _name_changed boolean;
BEGIN
  IF NEW.deliverable_id IS NULL THEN RETURN NEW; END IF;

  -- Anti-loop
  IF current_setting('app.deliv_task_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  _status_changed := NEW.status IS DISTINCT FROM OLD.status;
  _deadline_changed := NEW.deadline IS DISTINCT FROM OLD.deadline;
  _name_changed := NEW.name IS DISTINCT FROM OLD.name;

  IF NOT (_status_changed OR _deadline_changed OR _name_changed) THEN
    RETURN NEW;
  END IF;

  IF _status_changed THEN
    _new_deliv_status := CASE
      WHEN NEW.status = 'done'              THEN 'concluido'
      WHEN NEW.status = 'aguarda_feedback'  THEN 'aguarda_cliente'
      WHEN NEW.status = 'por_comecar'       THEN 'pendente'
      WHEN NEW.status IN ('a_fazer','para_aprovacao','precisa_alteracoes') THEN 'em_progresso'
      ELSE NULL
    END;
  END IF;

  PERFORM set_config('app.deliv_task_sync', 'on', true);
  UPDATE public.project_deliverables
    SET status = COALESCE(_new_deliv_status, status),
        scheduled_date = CASE WHEN _deadline_changed THEN NEW.deadline ELSE scheduled_date END,
        name = CASE WHEN _name_changed THEN NEW.name ELSE name END,
        updated_at = now()
    WHERE id = NEW.deliverable_id;
  PERFORM set_config('app.deliv_task_sync', 'off', true);

  RETURN NEW;
END;
$function$;

-- Replace the old trigger with the broader one
DROP TRIGGER IF EXISTS trg_sync_task_status_to_deliverable ON public.tasks;
DROP TRIGGER IF EXISTS sync_task_status_to_deliverable ON public.tasks;
DROP TRIGGER IF EXISTS trg_sync_task_to_deliverable ON public.tasks;

CREATE TRIGGER trg_sync_task_to_deliverable
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_to_deliverable();