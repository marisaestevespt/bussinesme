DROP FUNCTION IF EXISTS public.portal_email_allowed(text, text);

CREATE OR REPLACE FUNCTION public.portal_email_allowed(_token uuid, _email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id uuid;
  _normalized_email text;
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

  IF EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = _client_id
      AND lower(coalesce(c.email, '')) = _normalized_email
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_contacts cc
    WHERE cc.client_id = _client_id
      AND lower(coalesce(cc.email, '')) = _normalized_email
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE lower(coalesce(tm.email, '')) = _normalized_email
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_email_allowed(uuid, text) TO anon, authenticated;