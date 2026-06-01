-- Harden notify function to skip users whose profile no longer exists
CREATE OR REPLACE FUNCTION public.notify_deliverable_schedule_overrun()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id uuid;
  _msg text;
  _link text;
BEGIN
  IF NEW.scheduled_date IS NULL OR NEW.deadline IS NULL THEN RETURN NEW; END IF;
  IF NEW.scheduled_date <= NEW.deadline THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.scheduled_date IS NOT DISTINCT FROM NEW.scheduled_date
     AND OLD.deadline IS NOT DISTINCT FROM NEW.deadline THEN
    RETURN NEW;
  END IF;

  _owner_id := COALESCE(NEW.assigned_to, (SELECT assigned_to FROM public.projects WHERE id = NEW.project_id));
  IF _owner_id IS NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _owner_id) THEN
    RETURN NEW;
  END IF;

  _msg := 'A entrega "' || NEW.name || '" tem data de execução posterior ao deadline.';
  _link := '/projetos/' || NEW.project_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_owner_id, 'warning', 'Data de execução ultrapassa deadline', _msg, _link);

  RETURN NEW;
END;
$function$;

-- Add deadline to the trigger column list
DROP TRIGGER IF EXISTS trg_sync_deliverable_to_task ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliverable_to_task
AFTER INSERT OR UPDATE OF
  name, status, planned_end, scheduled_date, deadline,
  responsible_type, is_meeting, assigned_to, estimated_minutes, deliverable_type
ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.sync_deliverable_to_task();

-- Backfill task deadlines (notify trigger now safe vs orphan profiles)
UPDATE public.tasks t
SET deadline = COALESCE(d.deadline, d.scheduled_date, d.planned_end),
    updated_at = now()
FROM public.project_deliverables d
WHERE t.deliverable_id = d.id
  AND t.deadline IS DISTINCT FROM COALESCE(d.deadline, d.scheduled_date, d.planned_end);