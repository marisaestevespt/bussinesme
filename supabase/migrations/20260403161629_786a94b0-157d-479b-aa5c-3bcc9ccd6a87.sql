CREATE OR REPLACE FUNCTION public.get_portal_contract_documents(_token uuid)
RETURNS TABLE(project_name text, contract_documents jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.name, p.contract_documents
  FROM public.client_portals cp
  JOIN public.clients c ON c.id = cp.client_id
  JOIN public.projects p ON p.client_id = c.id
  WHERE cp.token = _token
    AND cp.is_active = true
    AND p.contract_documents IS NOT NULL
    AND p.contract_documents != '[]'::jsonb
  ORDER BY p.created_at DESC;
$$;