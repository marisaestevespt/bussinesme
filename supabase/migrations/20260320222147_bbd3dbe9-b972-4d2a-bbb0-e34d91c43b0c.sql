-- Add 'confirmada' to the meeting_status enum
ALTER TYPE public.meeting_status ADD VALUE IF NOT EXISTS 'confirmada';

-- Fix the portal_confirm_meeting function to handle all relevant statuses
CREATE OR REPLACE FUNCTION public.portal_confirm_meeting(_token uuid, _meeting_id uuid)
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
  SET status = 'confirmada'
  WHERE id = _meeting_id
    AND (client_id = _client_id OR (client_id IS NULL AND client_name = _client_name))
    AND status IN ('marcada', 'por_confirmar');

  RETURN FOUND;
END;
$$;