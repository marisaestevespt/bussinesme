-- 1) Trigger: cleanup task when a client_renewals row is deleted
CREATE OR REPLACE FUNCTION public.cleanup_task_on_renewal_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.tasks WHERE renewal_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_task_on_renewal_delete_trg ON public.client_renewals;
CREATE TRIGGER cleanup_task_on_renewal_delete_trg
BEFORE DELETE ON public.client_renewals
FOR EACH ROW EXECUTE FUNCTION public.cleanup_task_on_renewal_delete();

-- 2) RPC to cancel a scheduled renewal atomically
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

  SELECT pending_renewal_project_id, COALESCE(renewal_count,0) + 1
    INTO _project_id, _next_cycle
  FROM public.clients
  WHERE id = _client_id;

  IF _project_id IS NULL THEN
    RETURN jsonb_build_object('cancelled', false, 'reason', 'no_pending_renewal');
  END IF;

  -- Delete unpaid sales linked to the scheduled project
  WITH d AS (
    DELETE FROM public.commercial_sales
    WHERE project_id = _project_id AND status <> 'pago'
    RETURNING 1
  )
  SELECT count(*) INTO _deleted_sales FROM d;

  -- Delete the scheduled project (sales SET NULL via FK if any remain)
  DELETE FROM public.projects WHERE id = _project_id;

  -- Delete the orphan renewal checklist for the next cycle
  WITH d AS (
    DELETE FROM public.client_renewals
    WHERE client_id = _client_id AND cycle_number = _next_cycle
    RETURNING 1
  )
  SELECT count(*) INTO _deleted_renewals FROM d;

  -- Clear pending pointer
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