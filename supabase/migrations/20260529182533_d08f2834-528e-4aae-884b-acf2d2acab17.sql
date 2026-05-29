CREATE OR REPLACE FUNCTION public.portal_log_login(_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _portal_id uuid;
  _client_id uuid;
BEGIN
  SELECT id, client_id
  INTO _portal_id, _client_id
  FROM public.client_portals
  WHERE token = _token
    AND is_active = true;

  IF _portal_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.portal_audit_insert(
    'portal.session.created',
    _portal_id::text,
    jsonb_build_object('client_id', _client_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_log_login(uuid) TO anon, authenticated;