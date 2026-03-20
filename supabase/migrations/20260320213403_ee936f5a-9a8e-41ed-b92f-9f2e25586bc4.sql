CREATE OR REPLACE FUNCTION public.get_portal_client_context(_token uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  documents text,
  drive_folder_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.full_name, c.documents, c.drive_folder_url
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  WHERE cp.token = _token
    AND cp.is_active = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_client_context(uuid) TO anon, authenticated;