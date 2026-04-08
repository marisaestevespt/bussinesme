CREATE OR REPLACE FUNCTION public.portal_confirm_meeting(_token uuid, _meeting_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _client_id uuid;
BEGIN
  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true
  LIMIT 1;

  IF _client_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.meetings
  SET status = 'confirmada'
  WHERE id = _meeting_id
    AND (client_id = _client_id OR (client_id IS NULL AND client_name = (SELECT full_name FROM public.clients WHERE id = _client_id)))
    AND status IN ('marcada', 'por_confirmar');

  RETURN FOUND;
END;
$function$;