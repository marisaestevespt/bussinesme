-- 1. Enum for deliverable type
DO $$ BEGIN
  CREATE TYPE public.deliverable_type AS ENUM ('tarefa', 'reuniao', 'documento', 'aprovacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add column to template (product_deliverable_templates)
ALTER TABLE public.product_deliverable_templates
  ADD COLUMN IF NOT EXISTS deliverable_type public.deliverable_type NOT NULL DEFAULT 'tarefa';

-- 3. Add column to instance (project_deliverables)
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS deliverable_type public.deliverable_type NOT NULL DEFAULT 'tarefa';

-- 4. Backfill: any existing row with is_meeting = true becomes 'reuniao'
UPDATE public.product_deliverable_templates SET deliverable_type = 'reuniao' WHERE is_meeting = true AND deliverable_type = 'tarefa';
UPDATE public.project_deliverables          SET deliverable_type = 'reuniao' WHERE is_meeting = true AND deliverable_type = 'tarefa';

-- 5. Keep is_meeting and deliverable_type in sync (back-compat for legacy code)
CREATE OR REPLACE FUNCTION public.sync_deliverable_type_and_is_meeting()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- If deliverable_type changed, mirror to is_meeting
  IF TG_OP = 'INSERT' OR NEW.deliverable_type IS DISTINCT FROM OLD.deliverable_type THEN
    NEW.is_meeting := (NEW.deliverable_type = 'reuniao');
  -- If is_meeting changed but type didn't, mirror back
  ELSIF NEW.is_meeting IS DISTINCT FROM OLD.is_meeting THEN
    IF NEW.is_meeting = true AND NEW.deliverable_type = 'tarefa' THEN
      NEW.deliverable_type := 'reuniao';
    ELSIF NEW.is_meeting = false AND NEW.deliverable_type = 'reuniao' THEN
      NEW.deliverable_type := 'tarefa';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deliv_type_template ON public.product_deliverable_templates;
CREATE TRIGGER trg_sync_deliv_type_template
BEFORE INSERT OR UPDATE OF deliverable_type, is_meeting ON public.product_deliverable_templates
FOR EACH ROW EXECUTE FUNCTION public.sync_deliverable_type_and_is_meeting();

DROP TRIGGER IF EXISTS trg_sync_deliv_type_project ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliv_type_project
BEFORE INSERT OR UPDATE OF deliverable_type, is_meeting ON public.project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.sync_deliverable_type_and_is_meeting();

-- 6. Update template→project sync to carry deliverable_type forward
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
      duration_days = NEW.duration_days,
      duration_unit = COALESCE(NEW.duration_unit, 'dias_uteis'),
      offset_days = COALESCE(NEW.offset_days, 0),
      offset_trigger = COALESCE(NEW.offset_trigger, 'inicio_fase'),
      responsible_type = COALESCE(NEW.responsible_type, 'equipa'),
      responsible_role = NEW.responsible_role,
      deliverable_type = COALESCE(NEW.deliverable_type, 'tarefa')
    WHERE source_template_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.phase_id IS NOT NULL THEN
      INSERT INTO public.project_deliverables (project_id, phase_id, name, description, sort_order, linked_sop_id, source_template_id, status, portal_visible, is_recurring, duration_days, duration_unit, offset_days, offset_trigger, responsible_type, responsible_role, deliverable_type)
      SELECT pp.project_id, pp.id, NEW.name, NEW.description, NEW.sort_order, NEW.linked_sop_id, NEW.id, 'pendente',
             COALESCE(NEW.portal_visible, true), COALESCE(NEW.is_recurring, false),
             NEW.duration_days, COALESCE(NEW.duration_unit, 'dias_uteis'), COALESCE(NEW.offset_days, 0), COALESCE(NEW.offset_trigger, 'inicio_fase'),
             COALESCE(NEW.responsible_type, 'equipa'), NEW.responsible_role,
             COALESCE(NEW.deliverable_type, 'tarefa')
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

-- 7. Expose deliverable_type in the portal RPC
CREATE OR REPLACE FUNCTION public.get_portal_phases(_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(phase_row ORDER BY phase_row->>'sort_order'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', pp.id,
      'name', pp.name,
      'description', pp.description,
      'sort_order', pp.sort_order,
      'status', pp.status,
      'started_at', pp.started_at,
      'completed_at', pp.completed_at,
      'planned_start', pp.planned_start,
      'planned_end', pp.planned_end,
      'is_onboarding', pp.is_onboarding,
      'deliverables', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'id', pd.id,
            'name', pd.name,
            'description', pd.description,
            'status', pd.status,
            'sort_order', pd.sort_order,
            'planned_start', pd.planned_start,
            'planned_end', pd.planned_end,
            'responsible_type', pd.responsible_type,
            'is_meeting', pd.is_meeting,
            'meeting_id', pd.meeting_id,
            'deliverable_type', pd.deliverable_type
          ) ORDER BY pd.sort_order
        )
        FROM public.project_deliverables pd
        WHERE pd.phase_id = pp.id
          AND (pd.portal_visible = true OR pp.is_onboarding = true)),
        '[]'::jsonb
      )
    ) AS phase_row
    FROM public.client_portals cp
    JOIN public.clients c ON c.id = cp.client_id
    JOIN public.projects p ON p.client_id = c.id
    JOIN public.project_phases pp ON pp.project_id = p.id
    WHERE cp.token = _token
      AND cp.is_active = true
  ) sub
$$;