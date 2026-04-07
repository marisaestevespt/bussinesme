
ALTER TABLE public.client_portals ADD COLUMN IF NOT EXISTS slug text UNIQUE;

CREATE OR REPLACE FUNCTION public.get_portal_by_slug(_slug text)
 RETURNS TABLE(id uuid, token uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT cp.id, cp.token
  FROM public.client_portals cp
  WHERE cp.slug = _slug AND cp.is_active = true
  LIMIT 1;
$function$;
