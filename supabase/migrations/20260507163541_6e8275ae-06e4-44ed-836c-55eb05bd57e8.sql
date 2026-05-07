
CREATE OR REPLACE FUNCTION public.sync_product_deliverable_to_projects()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.project_deliverables SET
      name = NEW.name,
      description = NEW.description,
      sort_order = NEW.sort_order,
      linked_sop_id = NEW.linked_sop_id,
      portal_visible = COALESCE(NEW.portal_visible, true),
      is_recurring = COALESCE(NEW.is_recurring, false),
      responsible_type = COALESCE(NEW.responsible_type, 'equipa'),
      responsible_role = NEW.responsible_role,
      deliverable_type = COALESCE(NEW.deliverable_type, 'tarefa'),
      estimated_minutes = COALESCE(estimated_minutes, NEW.estimated_minutes),
      link_url = COALESCE(link_url, NEW.link_url),
      document_url = COALESCE(document_url, NEW.document_url),
      document_file_path = COALESCE(document_file_path, NEW.document_file_path),
      meeting_title_template = NEW.meeting_title_template
    WHERE source_template_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.phase_id IS NOT NULL THEN
      INSERT INTO public.project_deliverables (
        project_id, phase_id, name, description, sort_order, linked_sop_id,
        source_template_id, status, portal_visible, is_recurring,
        responsible_type, responsible_role, deliverable_type,
        estimated_minutes, link_url, document_url, document_file_path,
        meeting_title_template
      )
      SELECT pp.project_id, pp.id, NEW.name, NEW.description, NEW.sort_order, NEW.linked_sop_id,
             NEW.id, 'pendente',
             COALESCE(NEW.portal_visible, true), COALESCE(NEW.is_recurring, false),
             COALESCE(NEW.responsible_type, 'equipa'), NEW.responsible_role,
             COALESCE(NEW.deliverable_type, 'tarefa'),
             NEW.estimated_minutes, NEW.link_url, NEW.document_url, NEW.document_file_path,
             NEW.meeting_title_template
      FROM public.project_phases pp
      JOIN public.projects p ON p.id = pp.project_id
      WHERE pp.source_phase_id = NEW.phase_id
        AND p.status NOT IN ('concluido', 'cancelado');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.project_deliverables WHERE source_template_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;
