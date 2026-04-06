
CREATE OR REPLACE FUNCTION public.portal_toggle_onboarding_step(_token uuid, _step_id uuid, _completed boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  UPDATE public.client_onboarding
  SET completed = _completed
  WHERE id = _step_id AND client_id = _client_id;

  RETURN FOUND;
END;
$$;
