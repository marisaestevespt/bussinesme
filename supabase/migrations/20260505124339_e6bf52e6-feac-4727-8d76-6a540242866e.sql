-- Sync meeting date_time → linked deliverable deadline (and cascade to tasks via existing sync)
CREATE OR REPLACE FUNCTION public.sync_meeting_date_to_deliverable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_time IS DISTINCT FROM OLD.date_time AND NEW.date_time IS NOT NULL THEN
    UPDATE public.project_deliverables
       SET deadline = (NEW.date_time AT TIME ZONE 'UTC')::date,
           updated_at = now()
     WHERE meeting_id = NEW.id
       AND (deadline IS DISTINCT FROM (NEW.date_time AT TIME ZONE 'UTC')::date);
    UPDATE public.tasks
       SET deadline = (NEW.date_time AT TIME ZONE 'UTC')::date,
           updated_at = now()
     WHERE deliverable_id IN (SELECT id FROM public.project_deliverables WHERE meeting_id = NEW.id)
       AND (deadline IS DISTINCT FROM (NEW.date_time AT TIME ZONE 'UTC')::date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meeting_date_to_deliverable ON public.meetings;
CREATE TRIGGER trg_sync_meeting_date_to_deliverable
AFTER UPDATE OF date_time ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.sync_meeting_date_to_deliverable();

-- When a deliverable gets a meeting_id set/changed, copy the meeting date over
CREATE OR REPLACE FUNCTION public.sync_deliverable_meeting_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dt timestamptz;
BEGIN
  IF NEW.meeting_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.meeting_id IS DISTINCT FROM OLD.meeting_id) THEN
    SELECT date_time INTO v_dt FROM public.meetings WHERE id = NEW.meeting_id;
    IF v_dt IS NOT NULL THEN
      NEW.deadline := (v_dt AT TIME ZONE 'UTC')::date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deliverable_meeting_link ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliverable_meeting_link
BEFORE INSERT OR UPDATE OF meeting_id ON public.project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.sync_deliverable_meeting_link();

-- Backfill existing deliverables that have meeting_id but no deadline (or stale deadline)
UPDATE public.project_deliverables pd
   SET deadline = (m.date_time AT TIME ZONE 'UTC')::date,
       updated_at = now()
  FROM public.meetings m
 WHERE pd.meeting_id = m.id
   AND m.date_time IS NOT NULL
   AND (pd.deadline IS NULL OR pd.deadline IS DISTINCT FROM (m.date_time AT TIME ZONE 'UTC')::date);

UPDATE public.tasks t
   SET deadline = pd.deadline,
       updated_at = now()
  FROM public.project_deliverables pd
 WHERE t.deliverable_id = pd.id
   AND pd.meeting_id IS NOT NULL
   AND pd.deadline IS NOT NULL
   AND (t.deadline IS NULL OR t.deadline IS DISTINCT FROM pd.deadline);