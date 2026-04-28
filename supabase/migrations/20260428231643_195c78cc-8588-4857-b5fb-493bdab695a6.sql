REVOKE EXECUTE ON FUNCTION public.log_audit_entry(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_entry(text, text, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_profiles_basic() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_basic() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_system_config_value(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_config_value(text) TO authenticated;