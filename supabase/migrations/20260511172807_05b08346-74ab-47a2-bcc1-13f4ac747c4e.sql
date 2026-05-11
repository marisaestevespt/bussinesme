
ALTER TABLE public.client_portals ADD COLUMN IF NOT EXISTS playlist_url text;

DROP FUNCTION IF EXISTS public.get_portal_by_token(uuid);
DROP FUNCTION IF EXISTS public.get_portal_by_slug(text);

CREATE FUNCTION public.get_portal_by_token(_token uuid)
RETURNS TABLE(id uuid, token uuid, client_id uuid, is_active boolean, show_onboarding boolean, show_timeline boolean, show_payments boolean, show_meetings boolean, show_faqs boolean, show_monthly_summary boolean, show_workspace boolean, portal_type text, slug text, playlist_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT cp.id, cp.token, cp.client_id, cp.is_active, cp.show_onboarding, cp.show_timeline,
         cp.show_payments, cp.show_meetings, cp.show_faqs, cp.show_monthly_summary,
         cp.show_workspace, cp.portal_type::text, cp.slug, cp.playlist_url
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true
  LIMIT 1;
$$;

CREATE FUNCTION public.get_portal_by_slug(_slug text)
RETURNS TABLE(id uuid, token uuid, is_active boolean, client_id uuid, show_onboarding boolean, show_timeline boolean, show_payments boolean, show_meetings boolean, show_faqs boolean, show_monthly_summary boolean, show_workspace boolean, portal_type text, slug text, playlist_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT cp.id, cp.token, cp.is_active, cp.client_id, cp.show_onboarding, cp.show_timeline,
         cp.show_payments, cp.show_meetings, cp.show_faqs, cp.show_monthly_summary,
         cp.show_workspace, cp.portal_type::text, cp.slug, cp.playlist_url
  FROM public.client_portals cp
  WHERE cp.slug = _slug AND cp.is_active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_by_slug(text) TO anon, authenticated;
