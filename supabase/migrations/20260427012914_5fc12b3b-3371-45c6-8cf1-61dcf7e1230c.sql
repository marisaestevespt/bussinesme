CREATE OR REPLACE FUNCTION public.get_portal_meetings(_token uuid)
 RETURNS TABLE(id uuid, title text, date_time timestamp with time zone, status text, meeting_url text, department text, client_id uuid, project_id uuid, project_name text, portal_notes text, duration_minutes integer, discussion_points jsonb, discussion_notes text, client_actions jsonb, final_notes jsonb, priorities jsonb, documents jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    m.id, m.title, m.date_time, m.status::text, m.meeting_url, m.department,
    m.client_id, m.project_id, m.project_name, m.portal_notes, m.duration_minutes,
    CASE WHEN m.status::text IN ('realizada','concluida','terminada') THEN m.discussion_points ELSE '[]'::jsonb END,
    CASE WHEN m.status::text IN ('realizada','concluida','terminada') THEN m.discussion_notes ELSE '' END,
    CASE WHEN m.status::text IN ('realizada','concluida','terminada') THEN m.client_actions ELSE '[]'::jsonb END,
    CASE WHEN m.status::text IN ('realizada','concluida','terminada') THEN m.final_notes ELSE '[]'::jsonb END,
    CASE WHEN m.status::text IN ('realizada','concluida','terminada') THEN m.priorities ELSE '[]'::jsonb END,
    CASE WHEN m.status::text IN ('realizada','concluida','terminada') THEN m.documents ELSE '[]'::jsonb END
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.meetings m
    ON (m.client_id = cp.client_id OR (m.client_id IS NULL AND m.client_name = c.full_name))
  WHERE cp.token = _token AND cp.is_active = true
  ORDER BY m.date_time DESC;
$function$;