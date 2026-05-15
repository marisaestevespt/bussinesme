REVOKE EXECUTE ON FUNCTION public.sync_project_with_template(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_project_with_template(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_project_with_template(uuid) TO authenticated;