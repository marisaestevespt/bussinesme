DROP FUNCTION IF EXISTS public.get_portal_by_token(uuid);

CREATE FUNCTION public.get_portal_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  token uuid,
  client_id uuid,
  is_active boolean,
  show_onboarding boolean,
  show_timeline boolean,
  show_payments boolean,
  show_meetings boolean,
  show_faqs boolean,
  show_monthly_summary boolean,
  show_workspace boolean,
  portal_type text,
  slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cp.id,
    cp.token,
    cp.client_id,
    cp.is_active,
    cp.show_onboarding,
    cp.show_timeline,
    cp.show_payments,
    cp.show_meetings,
    cp.show_faqs,
    cp.show_monthly_summary,
    cp.show_workspace,
    cp.portal_type,
    cp.slug
  FROM public.client_portals cp
  WHERE cp.token = _token
    AND cp.is_active = true
  LIMIT 1;
$$;