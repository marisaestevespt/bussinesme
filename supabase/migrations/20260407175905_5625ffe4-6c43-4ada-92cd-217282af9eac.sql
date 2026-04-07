
CREATE OR REPLACE FUNCTION public.portal_add_meeting_notes(_token uuid, _meeting_id uuid, _notes text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _client_id uuid;
  _client_name text;
  _owner_user_id uuid;
  _meeting_title text;
BEGIN
  SELECT cp.client_id, c.full_name INTO _client_id, _client_name
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  WHERE cp.token = _token AND cp.is_active = true
  LIMIT 1;

  IF _client_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.meetings
  SET portal_notes = _notes
  WHERE id = _meeting_id
    AND (client_id = _client_id OR (client_id IS NULL AND client_name = _client_name));

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get meeting title
  SELECT title INTO _meeting_title FROM public.meetings WHERE id = _meeting_id;

  -- Notify all owners
  IF _notes IS NOT NULL AND _notes != '' THEN
    FOR _owner_user_id IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'owner'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        _owner_user_id,
        'info',
        '📅 Sugestão de horário alternativo',
        _client_name || ' sugeriu alternativas para a reunião "' || COALESCE(_meeting_title, 'Sem título') || '"',
        '/hub/reunioes/' || _meeting_id::text
      );
    END LOOP;
  END IF;

  RETURN true;
END;
$function$;
