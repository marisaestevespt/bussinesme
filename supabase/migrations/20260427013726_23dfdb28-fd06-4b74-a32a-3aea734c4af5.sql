
-- Function: sync phase status based on its deliverables
CREATE OR REPLACE FUNCTION public.sync_phase_status_from_deliverables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    -- All done → mark phase as concluida
    UPDATE public.project_phases
    SET status = 'concluida',
        completed_at = COALESCE(completed_at, now())
    WHERE id = _phase_id AND status <> 'concluida';

    -- Promote next phase (by sort_order) to em_curso, if still pendente
    SELECT id INTO _next_phase
    FROM public.project_phases
    WHERE project_id = _project_id
      AND sort_order > (SELECT sort_order FROM public.project_phases WHERE id = _phase_id)
      AND status = 'pendente'
    ORDER BY sort_order ASC LIMIT 1;

    IF _next_phase IS NOT NULL THEN
      UPDATE public.project_phases
      SET status = 'em_curso',
          started_at = COALESCE(started_at, now())
      WHERE id = _next_phase;
    END IF;
  ELSIF _total > 0 AND _done < _total THEN
    -- Self-heal: if it was concluida but now has pending work, revert
    UPDATE public.project_phases
    SET status = 'em_curso',
        completed_at = NULL
    WHERE id = _phase_id AND status = 'concluida';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_phase_status_from_deliverables ON public.project_deliverables;
CREATE TRIGGER trg_sync_phase_status_from_deliverables
AFTER INSERT OR UPDATE OF status OR DELETE ON public.project_deliverables
FOR EACH ROW EXECUTE FUNCTION public.sync_phase_status_from_deliverables();

-- Backfill: apply rule to all existing phases right now
DO $$
DECLARE r record; _next uuid;
BEGIN
  FOR r IN
    SELECT pp.id, pp.project_id, pp.sort_order, pp.status,
           (SELECT COUNT(*) FROM project_deliverables pd WHERE pd.phase_id=pp.id) AS total,
           (SELECT COUNT(*) FROM project_deliverables pd WHERE pd.phase_id=pp.id
              AND pd.status IN ('concluido','concluida','entregue','completed','done')) AS done
    FROM project_phases pp
  LOOP
    IF r.total > 0 AND r.done = r.total AND r.status <> 'concluida' THEN
      UPDATE project_phases SET status='concluida', completed_at=COALESCE(completed_at, now()) WHERE id = r.id;
      SELECT id INTO _next FROM project_phases
      WHERE project_id = r.project_id AND sort_order > r.sort_order AND status='pendente'
      ORDER BY sort_order ASC LIMIT 1;
      IF _next IS NOT NULL THEN
        UPDATE project_phases SET status='em_curso', started_at=COALESCE(started_at, now()) WHERE id = _next;
      END IF;
    END IF;
  END LOOP;
END $$;
