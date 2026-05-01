-- Auditoria portal: nivelar permissões das funções get_portal_responsibilities e get_portal_routines
-- com as restantes get_portal_* (que têm GRANT EXECUTE TO PUBLIC).
-- Sem este grant, qualquer chamada (e.g. via PostgREST/RPC) pode dar "permission denied".

REVOKE ALL ON FUNCTION public.get_portal_responsibilities(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_portal_routines(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_portal_responsibilities(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_portal_routines(uuid) TO PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_portal_responsibilities(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_portal_routines(uuid) TO anon, authenticated, service_role;