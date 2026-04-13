CREATE OR REPLACE FUNCTION public.notify_portal_questions_submitted(_client_name text, _client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_user_id uuid;
  _link text;
BEGIN
  _link := '/clientes/' || _client_id::text;

  FOR _owner_user_id IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'owner'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = _owner_user_id
        AND n.title = '📋 Respostas iniciais submetidas'
        AND n.link = _link
        AND n.created_at >= now() - interval '30 days'
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        _owner_user_id,
        'portal_questions_submitted',
        '📋 Respostas iniciais submetidas',
        _client_name || ' submeteu as respostas às perguntas iniciais do portal.',
        _link
      );
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_submit_initial_questions(_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _portal_id uuid;
  _client_id uuid;
  _client_name text;
  _total integer;
  _answered integer;
BEGIN
  SELECT cp.id, cp.client_id, c.full_name
  INTO _portal_id, _client_id, _client_name
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  WHERE cp.token = _token
    AND cp.is_active = true
  LIMIT 1;

  IF _portal_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (
           WHERE COALESCE(BTRIM(answer), '') <> ''
              OR (
                file_urls IS NOT NULL
                AND jsonb_typeof(file_urls::jsonb) = 'array'
                AND jsonb_array_length(file_urls::jsonb) > 0
              )
         )
  INTO _total, _answered
  FROM public.portal_initial_questions
  WHERE portal_id = _portal_id;

  IF _total = 0 OR _answered <> _total THEN
    RETURN false;
  END IF;

  PERFORM public.notify_portal_questions_submitted(_client_name, _client_id);
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_portal_meeting_confirmed(_client_name text, _meeting_id uuid, _meeting_title text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _owner_user_id uuid;
BEGIN
  FOR _owner_user_id IN
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'owner'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      _owner_user_id,
      'portal_meeting_confirmed',
      '✅ Reunião confirmada no portal',
      _client_name || ' confirmou presença na reunião "' || COALESCE(_meeting_title, 'Sem título') || '"',
      '/hub/reunioes/' || _meeting_id::text
    );
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_confirm_meeting(_token uuid, _meeting_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND status IN ('marcada', 'por_confirmar');

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT title INTO _meeting_title
  FROM public.meetings
  WHERE id = _meeting_id;

  PERFORM public.notify_portal_meeting_confirmed(_client_name, _meeting_id, _meeting_title);
  RETURN true;
END;
$function$;

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
  SET portal_notes = _notes,
      updated_at = now()
  WHERE id = _meeting_id
    AND (client_id = _client_id OR (client_id IS NULL AND client_name = _client_name));

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT title INTO _meeting_title FROM public.meetings WHERE id = _meeting_id;

  IF _notes IS NOT NULL AND _notes != '' THEN
    FOR _owner_user_id IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'owner'
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        _owner_user_id,
        'portal_meeting_change_request',
        '📅 Sugestão de horário alternativo',
        _client_name || ' sugeriu alternativas para a reunião "' || COALESCE(_meeting_title, 'Sem título') || '"',
        '/hub/reunioes/' || _meeting_id::text
      );
    END LOOP;
  END IF;

  RETURN true;
END;
$function$;