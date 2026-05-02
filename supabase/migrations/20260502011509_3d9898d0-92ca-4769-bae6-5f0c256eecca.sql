
-- Atualiza portal_record_visit para também inserir em portal_visits (com SECURITY DEFINER contorna RLS)
CREATE OR REPLACE FUNCTION public.portal_record_visit(_token uuid, _email text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _portal_id uuid;
  _normalized_email text;
BEGIN
  _normalized_email := lower(trim(coalesce(_email, '')));

  -- Atualiza timestamp da última visita no portal
  UPDATE public.client_portals
  SET last_visit_at = now()
  WHERE token = _token AND is_active = true
  RETURNING id INTO _portal_id;

  IF _portal_id IS NULL THEN
    RETURN;
  END IF;

  -- Regista visita individual (com email, se vier)
  INSERT INTO public.portal_visits (portal_id, email, visited_at)
  VALUES (_portal_id, NULLIF(_normalized_email, ''), now());
END;
$function$;
