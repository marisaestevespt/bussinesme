REVOKE EXECUTE ON FUNCTION public.profile_id_to_user_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.profile_id_to_user_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.profile_id_to_user_id(uuid) TO authenticated, service_role;