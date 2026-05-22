CREATE OR REPLACE FUNCTION public.cleanup_occurrence_links()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.linked_task_id IS NOT NULL THEN
    DELETE FROM public.tasks WHERE id = OLD.linked_task_id;
  END IF;
  IF OLD.linked_meeting_id IS NOT NULL THEN
    DELETE FROM public.meetings WHERE id = OLD.linked_meeting_id;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_occurrence_cleanup ON public.project_recurring_occurrences;
CREATE TRIGGER trg_occurrence_cleanup
AFTER DELETE ON public.project_recurring_occurrences
FOR EACH ROW EXECUTE FUNCTION public.cleanup_occurrence_links();