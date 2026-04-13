
-- Drop the phases-only trigger
DROP TRIGGER IF EXISTS trg_update_project_progress ON public.project_phases;

-- Recreate function based on deliverables within phases
CREATE OR REPLACE FUNCTION public.update_project_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _project_id uuid;
  _total integer;
  _done integer;
  _pct integer;
BEGIN
  -- Resolve project_id from either project_deliverables or project_phases
  IF TG_TABLE_NAME = 'project_deliverables' THEN
    _project_id := COALESCE(NEW.project_id, OLD.project_id);
  ELSIF TG_TABLE_NAME = 'project_phases' THEN
    _project_id := COALESCE(NEW.project_id, OLD.project_id);
  END IF;

  IF _project_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE pd.status = 'concluido')
  INTO _total, _done
  FROM public.project_deliverables pd
  JOIN public.project_phases pp ON pp.id = pd.phase_id
  WHERE pp.project_id = _project_id;

  IF _total > 0 THEN
    _pct := ROUND((_done::numeric / _total::numeric) * 100);
  ELSE
    _pct := 0;
  END IF;

  UPDATE public.projects SET progress = _pct WHERE id = _project_id;
  RETURN NEW;
END;
$$;

-- Trigger on deliverables changes
CREATE TRIGGER trg_update_project_progress_deliverables
AFTER INSERT OR UPDATE OR DELETE ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.update_project_progress();

-- Trigger on phases changes (in case phases are added/removed)
CREATE TRIGGER trg_update_project_progress_phases
AFTER INSERT OR UPDATE OR DELETE ON public.project_phases
FOR EACH ROW
EXECUTE FUNCTION public.update_project_progress();

-- Backfill all projects
UPDATE public.projects p
SET progress = COALESCE(sub.pct, 0)
FROM (
  SELECT pp.project_id,
         CASE WHEN COUNT(pd.id) > 0
              THEN ROUND((COUNT(pd.id) FILTER (WHERE pd.status = 'concluido')::numeric / COUNT(pd.id)::numeric) * 100)
              ELSE 0
         END AS pct
  FROM public.project_phases pp
  LEFT JOIN public.project_deliverables pd ON pd.phase_id = pp.id
  GROUP BY pp.project_id
) sub
WHERE p.id = sub.project_id;
