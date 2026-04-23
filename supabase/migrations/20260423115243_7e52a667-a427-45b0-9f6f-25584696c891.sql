DROP FUNCTION IF EXISTS public.get_portal_by_slug(text);

CREATE FUNCTION public.get_portal_by_slug(_slug text)
RETURNS TABLE(
  id uuid,
  token uuid,
  is_active boolean,
  client_id uuid,
  show_onboarding boolean,
  show_timeline boolean,
  show_payments boolean,
  show_meetings boolean,
  show_materials boolean,
  show_faqs boolean,
  show_monthly_summary boolean,
  show_workspace boolean,
  portal_type portal_type,
  slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    cp.id,
    cp.token,
    cp.is_active,
    cp.client_id,
    cp.show_onboarding,
    cp.show_timeline,
    cp.show_payments,
    cp.show_meetings,
    cp.show_materials,
    cp.show_faqs,
    cp.show_monthly_summary,
    cp.show_workspace,
    cp.portal_type,
    cp.slug
  FROM public.client_portals cp
  WHERE cp.slug = _slug AND cp.is_active = true
  LIMIT 1;
$function$;