CREATE OR REPLACE FUNCTION public.get_portal_project_history(_token uuid)
RETURNS TABLE(
  id uuid, project_name text, product_name text, start_date text, end_date text,
  status text, timeline_phases jsonb, monthly_summaries jsonb, notes text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT ph.id, ph.project_name, ph.product_name, ph.start_date, ph.end_date,
         ph.status, ph.timeline_phases, ph.monthly_summaries, ph.notes, ph.created_at
  FROM public.client_portals cp
  JOIN public.portal_project_history ph ON ph.portal_id = cp.id
  WHERE cp.token = _token AND cp.is_active = true
  ORDER BY ph.created_at DESC;
$$;