
-- Trigger: when a project_phase is inserted, if its project has no em_curso phase, promote the first pendente
CREATE OR REPLACE FUNCTION public.ensure_project_has_active_phase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _first_pending uuid;
BEGIN
  IF NEW.project_id IS NULL THEN RETURN NEW; END IF;

  -- Skip if project already has an em_curso phase
  IF EXISTS (SELECT 1 FROM public.project_phases WHERE project_id = NEW.project_id AND status = 'em_curso') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _first_pending
  FROM public.project_phases
  WHERE project_id = NEW.project_id AND status = 'pendente'
  ORDER BY sort_order ASC LIMIT 1;

  IF _first_pending IS NOT NULL THEN
    UPDATE public.project_phases
    SET status = 'em_curso', started_at = COALESCE(started_at, now())
    WHERE id = _first_pending;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_project_active_phase ON public.project_phases;
CREATE TRIGGER trg_ensure_project_active_phase
AFTER INSERT ON public.project_phases
FOR EACH ROW EXECUTE FUNCTION public.ensure_project_has_active_phase();

-- Backfill: promote first pendente phase for any active project missing an em_curso phase
DO $$
DECLARE r record; _first uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id AS project_id
    FROM projects p
    JOIN project_phases pp ON pp.project_id = p.id
    WHERE p.status NOT IN ('concluido','cancelado')
      AND NOT EXISTS (SELECT 1 FROM project_phases x WHERE x.project_id = p.id AND x.status = 'em_curso')
      AND EXISTS (SELECT 1 FROM project_phases x WHERE x.project_id = p.id AND x.status = 'pendente')
  LOOP
    SELECT id INTO _first FROM project_phases
    WHERE project_id = r.project_id AND status='pendente'
    ORDER BY sort_order ASC LIMIT 1;
    IF _first IS NOT NULL THEN
      UPDATE project_phases SET status='em_curso', started_at=COALESCE(started_at, now()) WHERE id = _first;
    END IF;
  END LOOP;
END $$;
