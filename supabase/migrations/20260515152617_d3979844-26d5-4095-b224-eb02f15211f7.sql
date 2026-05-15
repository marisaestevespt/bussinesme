CREATE OR REPLACE FUNCTION public.sync_project_with_template(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product_id uuid;
  _phases_added int := 0;
  _deliverables_added int := 0;
BEGIN
  SELECT product_id INTO _product_id FROM public.projects WHERE id = _project_id;
  IF _product_id IS NULL THEN
    RETURN jsonb_build_object('error', 'project has no product');
  END IF;

  WITH inserted_phases AS (
    INSERT INTO public.project_phases (
      project_id,
      name,
      description,
      sort_order,
      status,
      planned_start,
      planned_end
    )
    SELECT
      _project_id,
      pp.name,
      pp.description,
      pp.sort_order,
      'pendente',
      pp.planned_start,
      pp.planned_end
    FROM public.product_phases pp
    WHERE pp.product_id = _product_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.project_phases existing
        WHERE existing.project_id = _project_id
          AND (existing.sort_order = pp.sort_order OR lower(existing.name) = lower(pp.name))
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO _phases_added FROM inserted_phases;

  WITH inserted_deliverables AS (
    INSERT INTO public.project_deliverables (
      project_id, phase_id, name, description, sort_order, status,
      portal_visible, responsible_type, responsible_role, is_meeting,
      deliverable_type, source_template_id, link_url, document_url,
      estimated_minutes, meeting_title_template, document_file_path
    )
    SELECT _project_id, pp_proj.id, pdt.name, pdt.description, pdt.sort_order, 'pending',
      pdt.portal_visible, pdt.responsible_type, pdt.responsible_role, COALESCE(pdt.is_meeting,false),
      pdt.deliverable_type, pdt.id, pdt.link_url, pdt.document_url,
      pdt.estimated_minutes, pdt.meeting_title_template, pdt.document_file_path
    FROM public.product_deliverable_templates pdt
    LEFT JOIN public.product_phases pp ON pp.id = pdt.phase_id
    LEFT JOIN public.project_phases pp_proj
      ON pp_proj.project_id = _project_id
      AND (
        (pp.id IS NOT NULL AND pp_proj.sort_order = pp.sort_order)
        OR (pp.id IS NULL AND pp_proj.id IS NULL)
      )
    WHERE pdt.product_id = _product_id
      AND NOT EXISTS (
        SELECT 1 FROM public.project_deliverables pd
        WHERE pd.project_id = _project_id
          AND (pd.source_template_id = pdt.id OR pd.name = pdt.name)
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO _deliverables_added FROM inserted_deliverables;

  RETURN jsonb_build_object('phases_added', _phases_added, 'added', _deliverables_added);
END;
$$;