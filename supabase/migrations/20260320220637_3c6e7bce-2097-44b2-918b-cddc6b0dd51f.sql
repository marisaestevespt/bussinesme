
-- Add client_id column to meetings
ALTER TABLE public.meetings ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Migrate existing data: match client_name to clients.full_name
UPDATE public.meetings m
SET client_id = c.id
FROM public.clients c
WHERE m.client_name = c.full_name
  AND m.client_id IS NULL;

-- Update the portal_confirm_meeting function to use client_id
CREATE OR REPLACE FUNCTION public.portal_confirm_meeting(_token uuid, _meeting_id uuid)
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

  UPDATE public.meetings
  SET status = 'confirmada'
  WHERE id = _meeting_id
    AND client_id = _client_id
    AND status = 'agendada';

  RETURN FOUND;
END;
$$;
