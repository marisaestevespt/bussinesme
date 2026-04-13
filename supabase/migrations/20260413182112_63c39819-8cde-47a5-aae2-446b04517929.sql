
CREATE OR REPLACE FUNCTION public.portal_confirm_meeting(_token uuid, _meeting_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _client_id uuid;
  _client_name text;
  _meeting_title text;
BEGIN
  SELECT cp.client_id, c.full_name
  INTO _client_id, _client_name
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  WHERE cp.token = _token AND cp.is_active = true
  LIMIT 1;

  IF _client_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.meetings
  SET status = 'confirmada',
      updated_at = now()
  WHERE id = _meeting_id
    AND (client_id = _client_id OR (client_id IS NULL AND client_name = _client_name))
    AND status IN ('por_organizar', 'por_confirmar');

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT title INTO _meeting_title
  FROM public.meetings
  WHERE id = _meeting_id;

  PERFORM public.notify_portal_meeting_confirmed(_client_name, _meeting_id, _meeting_title);
  RETURN true;
END;
$$;
