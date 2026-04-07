ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS portal_notes text;

CREATE OR REPLACE FUNCTION public.portal_add_meeting_notes(_token uuid, _meeting_id uuid, _notes text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_id uuid;
  _client_name text;
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

  RETURN FOUND;
END;
$$;