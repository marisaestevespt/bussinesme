CREATE OR REPLACE FUNCTION public.sync_meeting_to_deliverable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.meet_deliv_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('realizada','terminada')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.project_id IS NOT NULL THEN
    PERFORM set_config('app.meet_deliv_sync', 'on', true);
    UPDATE public.project_deliverables
       SET status = 'concluido', updated_at = now()
     WHERE project_id = NEW.project_id
       AND is_meeting = true
       AND meeting_id = NEW.id
       AND status NOT IN ('concluido','entregue');
    PERFORM set_config('app.meet_deliv_sync', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: entregas ligadas a reuniões já realizadas/terminadas
UPDATE public.project_deliverables d
   SET status = 'concluido', updated_at = now()
  FROM public.meetings m
 WHERE d.meeting_id = m.id
   AND d.is_meeting = true
   AND m.status IN ('realizada','terminada')
   AND d.status NOT IN ('concluido','entregue');