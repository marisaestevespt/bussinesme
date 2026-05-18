CREATE OR REPLACE FUNCTION public.sync_phase_status_from_deliverables()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _phase_id uuid;
  _project_id uuid;
  _total int;
  _done int;
  _next_phase uuid;
BEGIN
  _phase_id := COALESCE(NEW.phase_id, OLD.phase_id);
  IF _phase_id IS NULL THEN RETURN NEW; END IF;

  SELECT project_id INTO _project_id FROM public.project_phases WHERE id = _phase_id;
  IF _project_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status IN ('concluido','concluida','entregue','completed','done'))
  INTO _total, _done
  FROM public.project_deliverables WHERE phase_id = _phase_id;

  IF _total > 0 AND _done = _total THEN
    UPDATE public.project_phases
    SET status = 'concluida',
        completed_at = COALESCE(completed_at, now())
    WHERE id = _phase_id AND status <> 'concluida';

    -- Promote next phase (by sort_order), SKIPPING offboarding phases
    -- (Offboarding só arranca quando o cliente entra mesmo em saída)
    SELECT id INTO _next_phase
    FROM public.project_phases
    WHERE project_id = _project_id
      AND sort_order > (SELECT sort_order FROM public.project_phases WHERE id = _phase_id)
      AND status = 'pendente'
      AND COALESCE(is_offboarding, false) = false
    ORDER BY sort_order ASC LIMIT 1;

    IF _next_phase IS NOT NULL THEN
      UPDATE public.project_phases
      SET status = 'em_curso',
          started_at = COALESCE(started_at, now())
      WHERE id = _next_phase;
    END IF;
  ELSIF _total > 0 AND _done < _total THEN
    UPDATE public.project_phases
    SET status = 'em_curso',
        completed_at = NULL
    WHERE id = _phase_id AND status = 'concluida';
  END IF;

  RETURN NEW;
END;
$function$;