CREATE OR REPLACE FUNCTION public.update_project_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _project_id uuid;
  _total integer;
  _done integer;
  _pct integer;
BEGIN
  IF TG_TABLE_NAME = 'project_deliverables' THEN
    _project_id := COALESCE(NEW.project_id, OLD.project_id);
    IF _project_id IS NULL THEN
      SELECT pp.project_id INTO _project_id
      FROM public.project_phases pp
      WHERE pp.id = COALESCE(NEW.phase_id, OLD.phase_id)
      LIMIT 1;
    END IF;
  ELSIF TG_TABLE_NAME = 'project_phases' THEN
    _project_id := COALESCE(NEW.project_id, OLD.project_id);
  END IF;

  IF _project_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*), COUNT(*) FILTER (
    WHERE pd.status IN ('concluido', 'concluida', 'entregue', 'completed', 'done')
  )
  INTO _total, _done
  FROM public.project_deliverables pd
  LEFT JOIN public.project_phases pp ON pp.id = pd.phase_id
  WHERE COALESCE(pd.project_id, pp.project_id) = _project_id;

  IF _total > 0 THEN
    _pct := ROUND((_done::numeric / _total::numeric) * 100);
  ELSE
    SELECT COUNT(*), COUNT(*) FILTER (
      WHERE pp.status IN ('concluida', 'concluido', 'completed', 'done')
    )
    INTO _total, _done
    FROM public.project_phases pp
    WHERE pp.project_id = _project_id;

    IF _total > 0 THEN
      _pct := ROUND((_done::numeric / _total::numeric) * 100);
    ELSE
      _pct := 0;
    END IF;
  END IF;

  UPDATE public.projects SET progress = _pct WHERE id = _project_id;
  RETURN NEW;
END;
$function$;