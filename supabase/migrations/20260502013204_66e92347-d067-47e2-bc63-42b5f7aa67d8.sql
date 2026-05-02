
CREATE OR REPLACE FUNCTION public.sync_project_with_template(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product_id uuid;
  _added int := 0;
BEGIN
  SELECT product_id INTO _product_id FROM projects WHERE id = _project_id;
  IF _product_id IS NULL THEN
    RETURN jsonb_build_object('error', 'project has no product');
  END IF;

  WITH inserted AS (
    INSERT INTO project_deliverables (
      project_id, phase_id, name, description, sort_order, status,
      portal_visible, responsible_type, responsible_role, is_meeting,
      deliverable_type, source_template_id, link_url, document_url
    )
    SELECT _project_id, pp_proj.id, pdt.name, pdt.description, pdt.sort_order, 'pending',
      pdt.portal_visible, pdt.responsible_type, pdt.responsible_role, COALESCE(pdt.is_meeting,false),
      pdt.deliverable_type, pdt.id, pdt.link_url, pdt.document_url
    FROM product_deliverable_templates pdt
    JOIN product_phases pp ON pp.id = pdt.phase_id
    JOIN project_phases pp_proj ON pp_proj.project_id = _project_id AND pp_proj.sort_order = pp.sort_order
    WHERE pdt.product_id = _product_id
      AND NOT EXISTS (
        SELECT 1 FROM project_deliverables pd
        WHERE pd.project_id = _project_id
          AND pd.phase_id = pp_proj.id
          AND (pd.source_template_id = pdt.id OR pd.name = pdt.name)
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO _added FROM inserted;

  RETURN jsonb_build_object('added', _added);
END;
$$;
