
CREATE OR REPLACE FUNCTION public.sync_client_end_of_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  _latest_deadline date;
BEGIN
  _client_id := COALESCE(NEW.client_id, OLD.client_id);
  
  IF _client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.deadline::date INTO _latest_deadline
  FROM public.projects p
  WHERE p.client_id = _client_id
    AND p.status NOT IN ('concluido', 'cancelado')
    AND p.deadline IS NOT NULL
  ORDER BY p.deadline DESC
  LIMIT 1;

  UPDATE public.clients
  SET end_of_cycle = _latest_deadline
  WHERE id = _client_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_client_end_of_cycle
AFTER INSERT OR UPDATE OF deadline, status, client_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_end_of_cycle();
