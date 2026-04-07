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
      'deliverables', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'id', pd.id,
            'name', pd.name,
            'description', pd.description,
            'status', pd.status,
            'sort_order', pd.sort_order
          ) ORDER BY pd.sort_order
        )
        FROM public.project_deliverables pd
        WHERE pd.phase_id = pp.id AND pd.portal_visible = true),
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