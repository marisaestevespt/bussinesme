CREATE OR REPLACE FUNCTION public.get_portal_project_assets(_token uuid)
RETURNS TABLE(
  id uuid,
  project_id uuid,
  project_name text,
  title text,
  description text,
  kind text,
  url text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  category text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.project_id, p.name AS project_name, a.title, a.description,
         a.kind, a.url, a.storage_path, a.mime_type, a.size_bytes, a.category, a.created_at
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.projects p ON p.client_id = c.id
  JOIN public.project_assets a ON a.project_id = p.id
  WHERE cp.token = _token
    AND cp.is_active = true
    AND a.page_key = 'entregaveis'
  ORDER BY p.created_at DESC, a.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_portal_project_asset_file_url(_token uuid, _asset_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.storage_path
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.projects p ON p.client_id = c.id
  JOIN public.project_assets a ON a.project_id = p.id
  WHERE cp.token = _token
    AND cp.is_active = true
    AND a.id = _asset_id
    AND a.page_key = 'entregaveis'
    AND a.storage_path IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_project_assets(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_project_asset_file_url(uuid, uuid) TO anon, authenticated;