CREATE OR REPLACE FUNCTION public.rollback_renewal_project(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project record;
  _paid_count integer;
  _deleted_payments integer := 0;
  _deleted_renewal_items integer := 0;
  _deleted_tasks integer := 0;
  _deleted_meetings integer := 0;
BEGIN
  IF NOT public.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Apenas owner/admin pode reverter renovações';
  END IF;

  SELECT id, client_id, created_at, status, name
  INTO _project
  FROM public.projects
  WHERE id = _project_id;

  IF _project.id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado';
  END IF;

  IF _project.client_id IS NULL THEN
    RAISE EXCEPTION 'Apenas projetos de cliente podem ser revertidos';
  END IF;

  IF _project.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Projeto criado há mais de 7 dias — rollback bloqueado';
  END IF;

  SELECT COUNT(*) INTO _paid_count
  FROM public.commercial_sales
  WHERE project_id = _project_id AND status = 'pago';

  IF _paid_count > 0 THEN
    RAISE EXCEPTION 'Existem % pagamento(s) pago(s) — não é possível reverter', _paid_count;
  END IF;

  -- 1. Clear scheduled renewal pointer on client (if it points to this project)
  UPDATE public.clients
  SET pending_renewal_project_id = NULL
  WHERE id = _project.client_id
    AND pending_renewal_project_id = _project_id;

  -- 2. Delete pending payments
  DELETE FROM public.commercial_sales
  WHERE project_id = _project_id AND status <> 'pago';
  GET DIAGNOSTICS _deleted_payments = ROW_COUNT;

  -- 3. Delete renewal checklist (cascade kills linked tasks)
  DELETE FROM public.client_renewals WHERE project_id = _project_id;
  GET DIAGNOSTICS _deleted_renewal_items = ROW_COUNT;

  -- 4. Null-out FK references on tables with NO ACTION on delete
  UPDATE public.commercial_library_entries SET project_id = NULL WHERE project_id = _project_id;
  UPDATE public.commercial_sales_actions   SET project_id = NULL WHERE project_id = _project_id;
  UPDATE public.content_items              SET project_id = NULL WHERE project_id = _project_id;
  UPDATE public.crm_pipelines              SET project_id = NULL WHERE project_id = _project_id;
  UPDATE public.meetings                   SET project_id = NULL WHERE project_id = _project_id;
  UPDATE public.planning_routines          SET project_id = NULL WHERE project_id = _project_id;
  UPDATE public.portal_project_history     SET project_id = NULL WHERE project_id = _project_id;

  -- 5. Delete standalone tasks attached to the project (not via deliverable/renewal)
  DELETE FROM public.tasks WHERE project_id = _project_id;
  GET DIAGNOSTICS _deleted_tasks = ROW_COUNT;

  -- 6. Decrement renewal_count
  UPDATE public.clients
  SET renewal_count = GREATEST(COALESCE(renewal_count, 1) - 1, 0)
  WHERE id = _project.client_id;

  -- 7. Delete the project (cascades phases, deliverables, members, etc.)
  DELETE FROM public.projects WHERE id = _project_id;

  PERFORM public.log_audit_entry(
    'deleted',
    'projects',
    _project_id::text,
    jsonb_build_object(
      'reason', 'renewal_rollback',
      'project_name', _project.name,
      'client_id', _project.client_id,
      'deleted_payments', _deleted_payments,
      'deleted_renewal_items', _deleted_renewal_items,
      'deleted_tasks', _deleted_tasks
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_payments', _deleted_payments,
    'deleted_renewal_items', _deleted_renewal_items,
    'deleted_tasks', _deleted_tasks
  );
END;
$$;