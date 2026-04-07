-- 1. Add source_template_id to project_deliverables
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.product_deliverable_templates(id) ON DELETE SET NULL;

-- 2. Sync function for product_phases changes
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
      offset_trigger = NEW.offset_trigger
    WHERE source_phase_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Create this phase in all projects that use this product
    INSERT INTO public.project_phases (project_id, name, description, sort_order, linked_sop_id, source_phase_id, status, duration_days, duration_unit, offset_days, offset_trigger)
    SELECT p.id, NEW.name, NEW.description, NEW.sort_order, NEW.linked_sop_id, NEW.id, 'pendente',
           NEW.duration_days, COALESCE(NEW.duration_unit, 'dias_uteis'), COALESCE(NEW.offset_days, 0), COALESCE(NEW.offset_trigger, 'inicio_projeto')
    FROM public.projects p
    WHERE p.product_id = NEW.product_id
      AND p.status NOT IN ('concluido', 'cancelado')
      -- Only if project already has phases from this product (was already "applied")
      AND EXISTS (
        SELECT 1 FROM public.project_phases pp
        WHERE pp.project_id = p.id AND pp.source_phase_id IS NOT NULL
      );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Remove corresponding project phases (deliverables cascade via phase_id ON DELETE SET NULL)
    DELETE FROM public.project_deliverables WHERE phase_id IN (
      SELECT id FROM public.project_phases WHERE source_phase_id = OLD.id
    );
    DELETE FROM public.project_phases WHERE source_phase_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Sync function for product_deliverable_templates changes
CREATE OR REPLACE FUNCTION public.sync_product_deliverable_to_projects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.project_deliverables SET
      name = NEW.name,
      description = NEW.description,
      sort_order = NEW.sort_order,
      linked_sop_id = NEW.linked_sop_id,
      portal_visible = COALESCE(NEW.portal_visible, true),
      is_recurring = COALESCE(NEW.is_recurring, false),
      duration_days = NEW.duration_days,
      duration_unit = COALESCE(NEW.duration_unit, 'dias_uteis'),
      offset_days = COALESCE(NEW.offset_days, 0),
      offset_trigger = COALESCE(NEW.offset_trigger, 'inicio_fase')
    WHERE source_template_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Create this deliverable in all project phases that came from the same product phase
    IF NEW.phase_id IS NOT NULL THEN
      INSERT INTO public.project_deliverables (project_id, phase_id, name, description, sort_order, linked_sop_id, source_template_id, status, portal_visible, is_recurring, duration_days, duration_unit, offset_days, offset_trigger)
      SELECT pp.project_id, pp.id, NEW.name, NEW.description, NEW.sort_order, NEW.linked_sop_id, NEW.id, 'pendente',
             COALESCE(NEW.portal_visible, true), COALESCE(NEW.is_recurring, false),
             NEW.duration_days, COALESCE(NEW.duration_unit, 'dias_uteis'), COALESCE(NEW.offset_days, 0), COALESCE(NEW.offset_trigger, 'inicio_fase')
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
$$;

-- 4. Create triggers
CREATE TRIGGER sync_product_phases_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.product_phases
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_phase_to_projects();

CREATE TRIGGER sync_product_deliverables_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.product_deliverable_templates
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_deliverable_to_projects();
