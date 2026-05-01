REVOKE ALL ON FUNCTION public.set_project_budget_from_product() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_project_budget_from_product() FROM anon;

REVOKE ALL ON FUNCTION public.sync_deliverable_to_task() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_deliverable_to_task() FROM anon;

REVOKE ALL ON FUNCTION public.suggest_task_estimate(text, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suggest_task_estimate(text, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.suggest_task_estimate(text, uuid, uuid, uuid) TO authenticated;