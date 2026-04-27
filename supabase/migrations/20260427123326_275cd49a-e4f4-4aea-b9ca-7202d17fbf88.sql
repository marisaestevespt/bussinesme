
-- Gap #1: prevent multiple scheduled renewals per client
CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_scheduled_project_per_client
  ON public.projects (client_id)
  WHERE status = 'agendado';

-- Gap #2: prevent duplicate renewal checklist per (client, cycle)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_renewal_per_cycle
  ON public.client_renewals (client_id, cycle_number);

-- Gap #9: harden cancel_scheduled_renewal authorization
CREATE OR REPLACE FUNCTION public.cancel_scheduled_renewal(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _project_id uuid;
  _next_cycle integer;
  _deleted_sales integer := 0;
  _deleted_renewals integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.is_admin_or_owner() THEN
    RAISE EXCEPTION 'forbidden: only owner/admin can cancel scheduled renewals';
  END IF;

  SELECT pending_renewal_project_id, COALESCE(renewal_count,0) + 1
    INTO _project_id, _next_cycle
  FROM public.clients
  WHERE id = _client_id;

  IF _project_id IS NULL THEN
    RETURN jsonb_build_object('cancelled', false, 'reason', 'no_pending_renewal');
  END IF;

  WITH d AS (
    DELETE FROM public.commercial_sales
    WHERE project_id = _project_id AND status <> 'pago'
    RETURNING 1
  )
  SELECT count(*) INTO _deleted_sales FROM d;

  DELETE FROM public.projects WHERE id = _project_id;

  WITH d AS (
    DELETE FROM public.client_renewals
    WHERE client_id = _client_id AND cycle_number = _next_cycle
    RETURNING 1
  )
  SELECT count(*) INTO _deleted_renewals FROM d;

  UPDATE public.clients
  SET pending_renewal_project_id = NULL
  WHERE id = _client_id;

  RETURN jsonb_build_object(
    'cancelled', true,
    'project_id', _project_id,
    'deleted_sales', _deleted_sales,
    'deleted_renewals', _deleted_renewals,
    'next_cycle', _next_cycle
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_renewal(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_renewal(uuid) TO authenticated;
