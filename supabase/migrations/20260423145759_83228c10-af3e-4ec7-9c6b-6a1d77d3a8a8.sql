-- 1. New column linking a deliverable to its scheduled meeting
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_deliverables_meeting_id
  ON public.project_deliverables(meeting_id) WHERE meeting_id IS NOT NULL;

-- 2. Trigger: when a meeting is inserted or its project_id changes, auto-link
--    it to the first meeting deliverable of that project that has no link yet.
CREATE OR REPLACE FUNCTION public.auto_link_meeting_to_deliverable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _deliverable_id uuid;
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if some deliverable already points to this meeting
  IF EXISTS (SELECT 1 FROM public.project_deliverables WHERE meeting_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT pd.id INTO _deliverable_id
  FROM public.project_deliverables pd
  JOIN public.project_phases pp ON pp.id = pd.phase_id
  WHERE pp.project_id = NEW.project_id
    AND pd.is_meeting = true
    AND pd.meeting_id IS NULL
    AND pd.status <> 'concluido'
  ORDER BY pp.sort_order, pd.sort_order
  LIMIT 1;

  IF _deliverable_id IS NOT NULL THEN
    UPDATE public.project_deliverables
    SET meeting_id = NEW.id
    WHERE id = _deliverable_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_meeting_to_deliverable ON public.meetings;
CREATE TRIGGER trg_auto_link_meeting_to_deliverable
AFTER INSERT OR UPDATE OF project_id ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_meeting_to_deliverable();

-- 3. Backfill: for every meeting deliverable not yet linked, try to find
--    a matching meeting in the same project.
UPDATE public.project_deliverables pd
SET meeting_id = sub.meeting_id
FROM (
  SELECT DISTINCT ON (pd2.id) pd2.id AS deliverable_id, m.id AS meeting_id
  FROM public.project_deliverables pd2
  JOIN public.project_phases pp ON pp.id = pd2.phase_id
  JOIN public.meetings m ON m.project_id = pp.project_id
  WHERE pd2.is_meeting = true
    AND pd2.meeting_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.project_deliverables pd3
      WHERE pd3.meeting_id = m.id
    )
  ORDER BY pd2.id, pp.sort_order, pd2.sort_order, m.date_time ASC
) sub
WHERE pd.id = sub.deliverable_id;

-- 4. Update get_portal_phases to return is_meeting and meeting_id
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
            'meeting_id', pd.meeting_id
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