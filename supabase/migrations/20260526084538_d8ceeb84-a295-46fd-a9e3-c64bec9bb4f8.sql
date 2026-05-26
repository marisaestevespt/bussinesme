UPDATE public.meetings m
SET project_name = p.name
FROM public.projects p
WHERE m.project_id = p.id
  AND (m.project_name IS DISTINCT FROM p.name);

CREATE OR REPLACE FUNCTION public.sync_meeting_project_name()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    NEW.project_name := NULL;
  ELSE
    SELECT name INTO NEW.project_name FROM public.projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meeting_project_name ON public.meetings;
CREATE TRIGGER trg_sync_meeting_project_name
BEFORE INSERT OR UPDATE OF project_id ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.sync_meeting_project_name();

CREATE OR REPLACE FUNCTION public.sync_meetings_on_project_rename()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.meetings SET project_name = NEW.name WHERE project_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meetings_on_project_rename ON public.projects;
CREATE TRIGGER trg_sync_meetings_on_project_rename
AFTER UPDATE OF name ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.sync_meetings_on_project_rename();