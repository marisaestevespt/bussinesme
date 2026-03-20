
CREATE OR REPLACE FUNCTION public.portal_confirm_meeting(_token uuid, _meeting_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_name text;
BEGIN
  SELECT c.full_name INTO _client_name
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  WHERE cp.token = _token AND cp.is_active = true
  LIMIT 1;

  IF _client_name IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.meetings
  SET status = 'confirmada'
  WHERE id = _meeting_id
    AND client_name = _client_name
    AND status = 'agendada';

  RETURN FOUND;
END;
$$;
