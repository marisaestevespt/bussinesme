CREATE OR REPLACE FUNCTION public.handle_client_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _client RECORD;
  _settings RECORD;
  _link text;
  _email_data jsonb;
BEGIN
  IF NEW.source <> 'portal' THEN
    RETURN NEW;
  END IF;

  SELECT id, full_name, account_manager_id INTO _client
  FROM public.clients WHERE id = NEW.client_id;

  IF _client.id IS NULL THEN RETURN NEW; END IF;

  _link := '/hub/clientes/' || NEW.client_id::text;

  PERFORM public.notify_team_users(
    'client_request_created',
    '📩 Novo pedido de cliente',
    coalesce(_client.full_name, 'Cliente') || ' enviou um pedido: ' || NEW.title,
    _link,
    'client-request-' || NEW.id::text,
    _client.account_manager_id
  );

  SELECT business_name INTO _settings FROM public.business_settings LIMIT 1;

  _email_data := jsonb_build_object(
    'clientName', coalesce(_client.full_name, 'Cliente'),
    'requestTitle', NEW.title,
    'requestMessage', coalesce(NEW.message, ''),
    'businessName', coalesce(_settings.business_name, '')
  );

  -- Owners + admins
  PERFORM public.queue_transactional_email(
    'team-client-request',
    u.email,
    'team-client-request-' || NEW.id::text || '-' || u.id::text,
    _email_data
  )
  FROM auth.users u
  JOIN public.user_roles ur ON ur.user_id = u.id
  WHERE ur.role IN ('owner', 'admin') AND u.email IS NOT NULL AND u.email <> '';

  -- Account manager (if set and not already covered)
  IF _client.account_manager_id IS NOT NULL THEN
    PERFORM public.queue_transactional_email(
      'team-client-request',
      u.email,
      'team-client-request-' || NEW.id::text || '-am-' || u.id::text,
      _email_data
    )
    FROM auth.users u
    WHERE u.id = _client.account_manager_id
      AND u.email IS NOT NULL AND u.email <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id AND ur.role IN ('owner','admin')
      );
  END IF;

  RETURN NEW;
END;
$function$;