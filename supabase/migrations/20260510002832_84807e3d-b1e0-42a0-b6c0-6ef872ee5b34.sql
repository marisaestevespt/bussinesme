
CREATE OR REPLACE FUNCTION public.sync_product_phase_to_projects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.project_phases SET
      name = NEW.name,
      description = NEW.description,
      sort_order = NEW.sort_order,
      linked_sop_id = NEW.linked_sop_id,
      duration_days = NEW.duration_days,
      duration_unit = NEW.duration_unit,
      offset_days = NEW.offset_days,
      offset_trigger = NEW.offset_trigger,
      is_onboarding = NEW.is_onboarding,
      is_offboarding = NEW.is_offboarding
    WHERE source_phase_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.project_phases
      (project_id, name, description, sort_order, linked_sop_id, source_phase_id, status,
       duration_days, duration_unit, offset_days, offset_trigger, is_onboarding, is_offboarding)
    SELECT p.id, NEW.name, NEW.description, NEW.sort_order, NEW.linked_sop_id, NEW.id, 'pendente',
           NEW.duration_days, COALESCE(NEW.duration_unit, 'dias_uteis'),
           COALESCE(NEW.offset_days, 0), COALESCE(NEW.offset_trigger, 'inicio_projeto'),
           COALESCE(NEW.is_onboarding, false), COALESCE(NEW.is_offboarding, false)
    FROM public.projects p
    WHERE p.product_id = NEW.product_id
      AND p.status NOT IN ('concluido', 'cancelado', 'arquivado')
      AND EXISTS (
        SELECT 1 FROM public.project_phases pp
        WHERE pp.project_id = p.id AND pp.source_phase_id IS NOT NULL
      );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.project_deliverables WHERE phase_id IN (
      SELECT id FROM public.project_phases WHERE source_phase_id = OLD.id
    );
    DELETE FROM public.project_phases WHERE source_phase_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;
