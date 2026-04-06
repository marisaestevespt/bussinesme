
CREATE OR REPLACE FUNCTION public.get_portal_onboarding(_token uuid)
RETURNS TABLE(
  id uuid,
  activity text,
  completed boolean,
  phase text,
  responsible text,
  due_date text,
  documents_links text,
  sort_order integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT co.id, co.activity, co.completed, co.phase, co.responsible, co.due_date, co.documents_links, co.sort_order
  FROM public.client_portals cp
  JOIN public.client_onboarding co ON co.client_id = cp.client_id
  WHERE cp.token = _token
    AND cp.is_active = true
  ORDER BY co.sort_order ASC;
$$;
