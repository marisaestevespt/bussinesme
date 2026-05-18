REVOKE EXECUTE ON FUNCTION public.calculate_project_progress(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_project_progress() FROM PUBLIC, anon, authenticated;