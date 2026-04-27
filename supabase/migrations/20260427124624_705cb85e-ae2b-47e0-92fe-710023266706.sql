
-- #11: cancel_scheduled_renewal — also delete unanswered portal initial questions
CREATE OR REPLACE FUNCTION public.cancel_scheduled_renewal(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _project_id uuid;
  _next_cycle integer;
  _portal_id uuid;
  _deleted_sales integer := 0;
  _deleted_renewals integer := 0;
  _deleted_questions integer := 0;
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

  SELECT id INTO _portal_id FROM public.client_portals WHERE client_id = _client_id LIMIT 1;

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

  -- #11: drop unanswered initial questions tied to this portal (preserve answered ones)
  IF _portal_id IS NOT NULL THEN
    WITH d AS (
      DELETE FROM public.portal_initial_questions
      WHERE portal_id = _portal_id
        AND (answer IS NULL OR btrim(answer) = '')
        AND answered_at IS NULL
      RETURNING 1
    )
    SELECT count(*) INTO _deleted_questions FROM d;
  END IF;

  UPDATE public.clients
  SET pending_renewal_project_id = NULL
  WHERE id = _client_id;

  -- Audit
  PERFORM public.log_audit_entry(
    'deleted', 'client_renewal', _client_id::text,
    jsonb_build_object(
      'project_id', _project_id,
      'cycle', _next_cycle,
      'deleted_sales', _deleted_sales,
      'deleted_renewals', _deleted_renewals,
      'deleted_unanswered_questions', _deleted_questions
    )
  );

  RETURN jsonb_build_object(
    'cancelled', true,
    'project_id', _project_id,
    'deleted_sales', _deleted_sales,
    'deleted_renewals', _deleted_renewals,
    'deleted_unanswered_questions', _deleted_questions,
    'next_cycle', _next_cycle
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_renewal(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_renewal(uuid) TO authenticated;
