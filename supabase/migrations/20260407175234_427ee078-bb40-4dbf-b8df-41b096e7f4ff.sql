DROP FUNCTION IF EXISTS public.get_portal_meetings(uuid);

CREATE FUNCTION public.get_portal_meetings(_token uuid)
 RETURNS TABLE(id uuid, title text, date_time timestamp with time zone, status text, meeting_url text, department text, client_id uuid, project_id uuid, project_name text, portal_notes text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    m.id,
    m.title,
    m.date_time,
    m.status,
    m.meeting_url,
    m.department,
    m.client_id,
    m.project_id,
    m.project_name,
    m.portal_notes
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.meetings m
    ON (
      m.client_id = cp.client_id
      OR (m.client_id IS NULL AND m.client_name = c.full_name)
    )
  WHERE cp.token = _token
    AND cp.is_active = true
  ORDER BY m.date_time DESC;
$$;