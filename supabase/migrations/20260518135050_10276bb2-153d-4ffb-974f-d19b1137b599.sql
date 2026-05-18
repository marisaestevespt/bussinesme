-- Propagate meeting_url across sibling recurring meetings
-- (same project_id + title). Only fills meetings that don't yet have a URL,
-- so manually customised links are preserved.

CREATE OR REPLACE FUNCTION public.propagate_meeting_url_to_siblings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when meeting_url is set to a non-empty value and changed
  IF NEW.meeting_url IS NULL OR length(trim(NEW.meeting_url)) = 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.meeting_url, '') = COALESCE(NEW.meeting_url, '') THEN
    RETURN NEW;
  END IF;
  IF NEW.project_id IS NULL OR NEW.title IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.meetings
     SET meeting_url = NEW.meeting_url,
         updated_at  = now()
   WHERE project_id = NEW.project_id
     AND title       = NEW.title
     AND id         <> NEW.id
     AND (meeting_url IS NULL OR length(trim(meeting_url)) = 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_meeting_url ON public.meetings;
CREATE TRIGGER trg_propagate_meeting_url
AFTER INSERT OR UPDATE OF meeting_url ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.propagate_meeting_url_to_siblings();

-- Backfill existing recurring meetings that already share a title+project
-- and where at least one already has a meeting_url set.
WITH src AS (
  SELECT DISTINCT ON (project_id, title)
         project_id, title, meeting_url
    FROM public.meetings
   WHERE project_id IS NOT NULL
     AND meeting_url IS NOT NULL
     AND length(trim(meeting_url)) > 0
   ORDER BY project_id, title, date_time DESC
)
UPDATE public.meetings m
   SET meeting_url = src.meeting_url,
       updated_at  = now()
  FROM src
 WHERE m.project_id = src.project_id
   AND m.title      = src.title
   AND (m.meeting_url IS NULL OR length(trim(m.meeting_url)) = 0);
