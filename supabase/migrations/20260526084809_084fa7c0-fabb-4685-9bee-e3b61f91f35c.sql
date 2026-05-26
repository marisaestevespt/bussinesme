CREATE OR REPLACE FUNCTION public.sync_meeting_client_name()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    NEW.client_name := NULL;
  ELSE
    SELECT full_name INTO NEW.client_name FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meeting_client_name ON public.meetings;
CREATE TRIGGER trg_sync_meeting_client_name
BEFORE INSERT OR UPDATE OF client_id ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.sync_meeting_client_name();

CREATE OR REPLACE FUNCTION public.sync_meetings_on_client_rename()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    UPDATE public.meetings SET client_name = NEW.full_name WHERE client_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meetings_on_client_rename ON public.clients;
CREATE TRIGGER trg_sync_meetings_on_client_rename
AFTER UPDATE OF full_name ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.sync_meetings_on_client_rename();