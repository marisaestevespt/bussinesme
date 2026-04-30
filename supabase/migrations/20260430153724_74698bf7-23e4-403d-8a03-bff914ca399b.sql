-- =========================================================
-- Bidirectional date sync between project_deliverables (is_meeting=true)
-- and meetings (date_time)
-- =========================================================

-- 1) Deliverable -> Meeting: when planned_end changes on a meeting-deliverable
--    that has meeting_id, push the new date into meetings.date_time
--    while preserving the original time-of-day.
CREATE OR REPLACE FUNCTION public.sync_deliverable_date_to_meeting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_dt timestamptz;
  _new_dt     timestamptz;
BEGIN
  IF NEW.meeting_id IS NULL OR NEW.is_meeting = false OR NEW.planned_end IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.planned_end IS NOT DISTINCT FROM OLD.planned_end THEN
    RETURN NEW;
  END IF;

  SELECT date_time INTO _current_dt FROM public.meetings WHERE id = NEW.meeting_id;
  IF _current_dt IS NULL THEN RETURN NEW; END IF;

  -- Compose new timestamp: planned_end (date) at the existing meeting time-of-day
  _new_dt := (NEW.planned_end::text || ' ' || to_char(_current_dt, 'HH24:MI:SSOF'))::timestamptz;

  IF _new_dt IS DISTINCT FROM _current_dt THEN
    UPDATE public.meetings
    SET date_time = _new_dt, updated_at = now()
    WHERE id = NEW.meeting_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deliverable_date_to_meeting ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliverable_date_to_meeting
AFTER INSERT OR UPDATE OF planned_end, meeting_id
ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.sync_deliverable_date_to_meeting();

-- 2) Meeting -> Deliverable: when meetings.date_time changes, push the date
--    into the linked deliverable's planned_end.
CREATE OR REPLACE FUNCTION public.sync_meeting_date_to_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.date_time IS NOT DISTINCT FROM OLD.date_time THEN
    RETURN NEW;
  END IF;

  UPDATE public.project_deliverables
  SET planned_end = NEW.date_time::date,
      updated_at = now()
  WHERE meeting_id = NEW.id
    AND (planned_end IS DISTINCT FROM NEW.date_time::date);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meeting_date_to_deliverable ON public.meetings;
CREATE TRIGGER trg_sync_meeting_date_to_deliverable
AFTER UPDATE OF date_time
ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.sync_meeting_date_to_deliverable();