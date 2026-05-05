CREATE OR REPLACE FUNCTION public.portal_email_allowed(_token uuid, _email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _client_id uuid;
  _normalized_email text;
  _user_id uuid;
BEGIN
  _normalized_email := lower(trim(coalesce(_email, '')));

  IF _normalized_email = '' THEN
    RETURN false;
  END IF;

  SELECT cp.client_id
  INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token
    AND cp.is_active = true
  LIMIT 1;

  IF _client_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1) Email do próprio cliente
  IF EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = _client_id
      AND lower(coalesce(c.email, '')) = _normalized_email
  ) THEN
    RETURN true;
  END IF;

  -- 2) Contactos adicionais do cliente
  IF EXISTS (
    SELECT 1
    FROM public.client_contacts cc
    WHERE cc.client_id = _client_id
      AND lower(coalesce(cc.email, '')) = _normalized_email
  ) THEN
    RETURN true;
  END IF;

  -- 3) Procura user pelo email no auth.users
  SELECT u.id INTO _user_id
  FROM auth.users u
  WHERE lower(u.email) = _normalized_email
  LIMIT 1;

  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- 4) Owner ou Admin da plataforma
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('owner','admin')
  ) THEN
    RETURN true;
  END IF;

  -- 5) Membro da equipa atribuído a um projeto deste cliente
  IF EXISTS (
    SELECT 1
    FROM public.project_members pm
    JOIN public.projects p ON p.id = pm.project_id
    JOIN public.profiles pr ON pr.id = pm.profile_id
    WHERE p.client_id = _client_id
      AND pr.user_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;