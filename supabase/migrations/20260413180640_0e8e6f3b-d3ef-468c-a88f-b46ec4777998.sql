
-- Trigger function to auto-calculate project progress from deliverables
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
  _project_id := COALESCE(NEW.project_id, OLD.project_id);
  IF _project_id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluido')
  INTO _total, _done
  FROM public.project_deliverables
  WHERE project_id = _project_id;

  IF _total > 0 THEN
    _pct := ROUND((_done::numeric / _total::numeric) * 100);
  ELSE
    _pct := 0;
  END IF;

  UPDATE public.projects SET progress = _pct WHERE id = _project_id;
  RETURN NEW;
END;
$$;

-- Fire on any deliverable change
CREATE TRIGGER trg_update_project_progress
AFTER INSERT OR UPDATE OR DELETE ON public.project_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.update_project_progress();

-- Backfill current progress for all projects
UPDATE public.projects p
SET progress = sub.pct
FROM (
  SELECT project_id,
         CASE WHEN COUNT(*) > 0
              THEN ROUND((COUNT(*) FILTER (WHERE status = 'concluido')::numeric / COUNT(*)::numeric) * 100)
              ELSE 0
         END AS pct
  FROM public.project_deliverables
  GROUP BY project_id
) sub
WHERE p.id = sub.project_id;
