DROP FUNCTION IF EXISTS public.get_portal_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_portal_by_slug(_slug text)
RETURNS TABLE(id uuid, token uuid, is_active boolean, client_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.id, cp.token, cp.is_active, cp.client_id
  FROM public.client_portals cp
  WHERE cp.slug = _slug AND cp.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_by_slug(text) TO anon, authenticated;