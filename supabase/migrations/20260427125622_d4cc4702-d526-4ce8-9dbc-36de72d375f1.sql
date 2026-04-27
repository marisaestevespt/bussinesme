CREATE OR REPLACE FUNCTION public.rollback_renewal_project(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project record;
  _paid_count integer;
  _deleted_payments integer;
  _deleted_renewal_items integer;
BEGIN
  -- Permission check
  IF NOT public.is_admin_or_owner() THEN
    RAISE EXCEPTION 'Apenas owner/admin pode reverter renovações';
  END IF;

  -- Load project
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

  -- Time window: 7 days
  IF _project.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Projeto criado há mais de 7 dias — rollback bloqueado';
  END IF;

  -- Block if any paid sale exists for this project
  SELECT COUNT(*) INTO _paid_count
  FROM public.commercial_sales
  WHERE project_id = _project_id AND status = 'pago';

  IF _paid_count > 0 THEN
    RAISE EXCEPTION 'Existem % pagamento(s) pago(s) — não é possível reverter', _paid_count;
  END IF;

  -- Delete pending payments
  DELETE FROM public.commercial_sales
  WHERE project_id = _project_id AND status <> 'pago';
  GET DIAGNOSTICS _deleted_payments = ROW_COUNT;

  -- Delete renewal checklist linked to project (cascade kills tasks)
  DELETE FROM public.client_renewals
  WHERE project_id = _project_id;
  GET DIAGNOSTICS _deleted_renewal_items = ROW_COUNT;

  -- Decrement renewal_count if > 0
  UPDATE public.clients
  SET renewal_count = GREATEST(COALESCE(renewal_count, 1) - 1, 0)
  WHERE id = _project.client_id;

  -- Delete project (cascade clears related items)
  DELETE FROM public.projects WHERE id = _project_id;

  -- Audit
  PERFORM public.log_audit_entry(
    'deleted',
    'projects',
    _project_id::text,
    jsonb_build_object(
      'reason', 'renewal_rollback',
      'project_name', _project.name,
      'client_id', _project.client_id,
      'deleted_payments', _deleted_payments,
      'deleted_renewal_items', _deleted_renewal_items
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_payments', _deleted_payments,
    'deleted_renewal_items', _deleted_renewal_items
  );
END;
$$;