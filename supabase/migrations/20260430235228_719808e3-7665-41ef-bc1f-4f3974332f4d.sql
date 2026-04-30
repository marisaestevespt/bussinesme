
CREATE OR REPLACE FUNCTION public.get_portal_responsibilities(_token uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  project_name text,
  description text,
  party text,
  notes text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.id, pr.project_id, p.name as project_name, pr.description, pr.party, pr.notes, pr.sort_order
  FROM public.project_responsibilities pr
  JOIN public.projects p ON p.id = pr.project_id
  JOIN public.client_portals cp ON cp.client_id = p.client_id
  WHERE cp.token = _token
    AND cp.is_active = true
    AND p.archived_at IS NULL
    AND p.type = 'cliente_servico_mensal'
  ORDER BY p.name, pr.sort_order;
$$;

REVOKE ALL ON FUNCTION public.get_portal_responsibilities(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_responsibilities(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_portal_routines(_token uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  project_name text,
  title text,
  recurrence_type text,
  weekday integer,
  month_day integer,
  hour_time time,
  estimated_time numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.id, pr.project_id, p.name as project_name, pr.title,
         pr.recurrence_type, pr.weekday, pr.month_day, pr.hour_time, pr.estimated_time
  FROM public.planning_routines pr
  JOIN public.projects p ON p.id = pr.project_id
  JOIN public.client_portals cp ON cp.client_id = p.client_id
  WHERE cp.token = _token
    AND cp.is_active = true
    AND pr.active = true
    AND p.archived_at IS NULL
    AND p.type = 'cliente_servico_mensal'
  ORDER BY p.name, pr.recurrence_type, pr.title;
$$;

REVOKE ALL ON FUNCTION public.get_portal_routines(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_routines(uuid) TO anon, authenticated;
