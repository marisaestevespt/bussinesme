-- Public portal access RPCs must be callable by anonymous visitors.
-- Without these grants, the portal auth page shows "Portal não encontrado".
GRANT EXECUTE ON FUNCTION public.get_portal_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_portal_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_portal_client_context(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_portal_branding(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.portal_email_allowed(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.portal_record_visit(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.portal_log_login(uuid) TO anon;