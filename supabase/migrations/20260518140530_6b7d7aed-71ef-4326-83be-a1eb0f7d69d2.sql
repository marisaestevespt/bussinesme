
CREATE OR REPLACE FUNCTION public.sync_briefing_deliverable_from_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal_id uuid;
  v_client_id uuid;
  v_unanswered int;
  v_total int;
BEGIN
  v_portal_id := COALESCE(NEW.portal_id, OLD.portal_id);
  IF v_portal_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT client_id INTO v_client_id FROM client_portals WHERE id = v_portal_id;
  IF v_client_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE (answer IS NULL OR btrim(answer) = '')
        AND (file_urls IS NULL OR jsonb_array_length(COALESCE(to_jsonb(file_urls), '[]'::jsonb)) = 0)
    ),
    COUNT(*)
  INTO v_unanswered, v_total
  FROM portal_initial_questions
  WHERE portal_id = v_portal_id;

  IF v_total = 0 THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE project_deliverables pd
  SET status = CASE WHEN v_unanswered = 0 THEN 'concluido' ELSE 'pendente' END,
      updated_at = now()
  FROM projects p
  WHERE pd.project_id = p.id
    AND p.client_id = v_client_id
    AND pd.responsible_type = 'cliente'
    AND pd.name ILIKE '%briefing inicial%'
    AND pd.status IS DISTINCT FROM (CASE WHEN v_unanswered = 0 THEN 'concluido' ELSE 'pendente' END);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_briefing_deliverable ON public.portal_initial_questions;
CREATE TRIGGER trg_sync_briefing_deliverable
AFTER INSERT OR UPDATE OR DELETE ON public.portal_initial_questions
FOR EACH ROW
EXECUTE FUNCTION public.sync_briefing_deliverable_from_questions();

-- One-time backfill for all existing portals
WITH per_portal AS (
  SELECT
    cp.client_id,
    COUNT(*) FILTER (
      WHERE (q.answer IS NULL OR btrim(q.answer) = '')
        AND (q.file_urls IS NULL OR jsonb_array_length(COALESCE(to_jsonb(q.file_urls), '[]'::jsonb)) = 0)
    ) AS unanswered,
    COUNT(*) AS total
  FROM client_portals cp
  JOIN portal_initial_questions q ON q.portal_id = cp.id
  GROUP BY cp.client_id
)
UPDATE project_deliverables pd
SET status = CASE WHEN pp.unanswered = 0 THEN 'concluido' ELSE 'pendente' END,
    updated_at = now()
FROM projects p
JOIN per_portal pp ON pp.client_id = p.client_id
WHERE pd.project_id = p.id
  AND pd.responsible_type = 'cliente'
  AND pd.name ILIKE '%briefing inicial%'
  AND pp.total > 0;
