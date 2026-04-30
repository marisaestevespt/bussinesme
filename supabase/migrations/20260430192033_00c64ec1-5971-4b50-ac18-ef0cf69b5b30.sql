DROP TRIGGER IF EXISTS trg_sync_deliverable_to_task ON public.project_deliverables;
CREATE TRIGGER trg_sync_deliverable_to_task
AFTER INSERT OR UPDATE OF name, status, planned_end, scheduled_date, responsible_type, is_meeting, assigned_to, estimated_minutes
ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.sync_deliverable_to_task();