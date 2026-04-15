-- Restrict anon SELECT on client_portals to only rows matching a specific token or slug
DROP POLICY IF EXISTS "Anyone can view portals" ON public.client_portals;
DROP POLICY IF EXISTS "Anon can view portals" ON public.client_portals;
DROP POLICY IF EXISTS "Public can view portals" ON public.client_portals;
DROP POLICY IF EXISTS "Anyone can view client portals" ON public.client_portals;
DROP POLICY IF EXISTS "Anon can view client portals" ON public.client_portals;

-- Anon can only read a portal row if they know the token or slug (prevents enumeration)
CREATE POLICY "Anon can view portal by token or slug"
  ON public.client_portals FOR SELECT TO anon
  USING (false);

-- Create a security definer function for token-based portal lookup
CREATE OR REPLACE FUNCTION public.get_portal_by_token(_token uuid)
RETURNS TABLE(id uuid, client_id uuid, is_active boolean, show_onboarding boolean, show_timeline boolean, show_payments boolean, show_meetings boolean, show_materials boolean, show_faqs boolean, show_monthly_summary boolean, show_workspace boolean, portal_type public.portal_type, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.id, cp.client_id, cp.is_active, cp.show_onboarding, cp.show_timeline, cp.show_payments, cp.show_meetings, cp.show_materials, cp.show_faqs, cp.show_monthly_summary, cp.show_workspace, cp.portal_type, cp.slug
  FROM public.client_portals cp
  WHERE cp.token = _token AND cp.is_active = true
  LIMIT 1;
$$;