CREATE OR REPLACE FUNCTION public.portal_submit_proactive_nps(
  _token uuid,
  _score integer,
  _notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _client_id uuid;
BEGIN
  IF _score < 0 OR _score > 10 THEN RETURN false; END IF;

  SELECT cp.client_id INTO _client_id
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true;

  IF _client_id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.client_nps_records (
    client_id, nps_score, notes, status, expected_date, actual_date, source
  ) VALUES (
    _client_id, _score, NULLIF(trim(_notes), ''), 'concluido',
    CURRENT_DATE, CURRENT_DATE, 'portal'
  );

  RETURN true;
END $$;