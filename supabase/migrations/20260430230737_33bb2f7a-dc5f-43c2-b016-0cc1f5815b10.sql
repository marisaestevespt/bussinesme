-- Update get_portal_phases to include attachment fields
CREATE OR REPLACE FUNCTION public.get_portal_phases(_token uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ) sub
$function$;

-- RPC to issue a short-lived signed URL for an internal deliverable file,
-- only when the token + deliverable belong to the same client portal.
CREATE OR REPLACE FUNCTION public.get_portal_deliverable_file_url(_token uuid, _deliverable_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  _path text;
  _signed jsonb;
BEGIN
  SELECT pd.document_file_path INTO _path
  FROM public.project_deliverables pd
  JOIN public.project_phases pp ON pp.id = pd.phase_id
  JOIN public.projects p ON p.id = pp.project_id
  JOIN public.clients c ON c.id = p.client_id
  JOIN public.client_portals cp ON cp.client_id = c.id
  WHERE cp.token = _token
    AND cp.is_active = true
    AND pd.id = _deliverable_id
    AND (pd.portal_visible = true OR pp.is_onboarding = true)
    AND pd.document_file_path IS NOT NULL
  LIMIT 1;

  IF _path IS NULL THEN
    RETURN NULL;
  END IF;

  -- Return only the path; client builds the URL via supabase.storage
  -- (we expose the path back so frontend can call createSignedUrl through
  -- a service role edge function if needed). For now return the path.
  RETURN _path;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_portal_deliverable_file_url(uuid, uuid) TO anon, authenticated;