CREATE OR REPLACE FUNCTION public.get_portal_phases(_token uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH phases AS (
    SELECT jsonb_build_object(
      'id', pp.id,
      'project_id', p.id,
      'project_name', p.name,
      'project_progress', p.progress,
      'project_type', p.type,
      'project_mode', p.project_mode,
      'name', pp.name,
      'description', pp.description,
      'sort_order', pp.sort_order,
      'status', pp.status,
      'started_at', pp.started_at,
      'completed_at', pp.completed_at,
      'planned_start', pp.planned_start,
      'planned_end', pp.planned_end,
      'is_onboarding', pp.is_onboarding,
      'is_offboarding', pp.is_offboarding,
      'is_recurring', (pp.recurrence_period IS NOT NULL),
      'recurrence_period', pp.recurrence_period,
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
            'deliverable_type', pd.deliverable_type,
            'link_url', pd.link_url,
            'document_url', pd.document_url,
            'document_file_path', pd.document_file_path
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
      AND p.archived_at IS NULL
      AND (
        pp.is_offboarding = false
        OR (pp.is_offboarding = true AND c.status IN ('em_offboarding', 'terminado'))
      )
  ),
  orphans AS (
    SELECT jsonb_build_object(
      'id', 'orphan-' || p.id::text,
      'project_id', p.id,
      'project_name', p.name,
      'project_progress', p.progress,
      'project_type', p.type,
      'project_mode', p.project_mode,
      'name', 'Outras Entregas',
      'description', NULL,
      'sort_order', 9999,
      'status', 'em_curso',
      'started_at', NULL,
      'completed_at', NULL,
      'planned_start', NULL,
      'planned_end', NULL,
      'is_onboarding', false,
      'is_offboarding', false,
      'is_recurring', false,
      'recurrence_period', NULL,
      'deliverables', jsonb_agg(
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
          'deliverable_type', pd.deliverable_type,
          'link_url', pd.link_url,
          'document_url', pd.document_url,
          'document_file_path', pd.document_file_path
        ) ORDER BY pd.sort_order
      )
    ) AS phase_row
    FROM public.client_portals cp
    JOIN public.clients c ON c.id = cp.client_id
    JOIN public.projects p ON p.client_id = c.id
    JOIN public.project_deliverables pd ON pd.project_id = p.id
    WHERE cp.token = _token
      AND cp.is_active = true
      AND p.archived_at IS NULL
      AND pd.phase_id IS NULL
      AND pd.portal_visible = true
    GROUP BY p.id, p.name, p.progress, p.type, p.project_mode
  )
  SELECT COALESCE(jsonb_agg(phase_row ORDER BY phase_row->>'sort_order'), '[]'::jsonb)
  FROM (
    SELECT phase_row FROM phases
    UNION ALL
    SELECT phase_row FROM orphans
  ) sub
$function$;