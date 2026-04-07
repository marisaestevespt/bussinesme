CREATE OR REPLACE FUNCTION public.portal_toggle_deliverable(_token uuid, _deliverable_id uuid, _completed boolean)
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

  UPDATE public.project_deliverables
  SET status = CASE WHEN _completed THEN 'concluido' ELSE 'pendente' END,
      updated_at = now()
  WHERE id = _deliverable_id
    AND responsible_type = 'cliente'
    AND phase_id IN (
      SELECT pp.id FROM public.project_phases pp
      JOIN public.projects p ON p.id = pp.project_id
      WHERE p.client_id = _client_id
    );

  RETURN FOUND;
END;
$$;