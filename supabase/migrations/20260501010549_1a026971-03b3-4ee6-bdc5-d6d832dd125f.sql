CREATE OR REPLACE FUNCTION public.suggest_task_estimate(
  _name text,
  _sop_id uuid DEFAULT NULL,
  _project_id uuid DEFAULT NULL,
  _deliverable_template_id uuid DEFAULT NULL
)
RETURNS TABLE(
  avg_minutes integer,
  sample_count integer,
  matched_task_name text,
  confidence text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH context_project AS (
    SELECT product_id
    FROM public.projects
    WHERE id = _project_id
  ),
  input AS (
    SELECT
      trim(lower(regexp_replace(translate(coalesce(_name, ''), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g'))) AS normalized_name,
      (SELECT product_id FROM context_project) AS product_id
  ),
  actuals AS (
    SELECT task_id, SUM(duration_minutes)::integer AS actual_minutes, COUNT(*)::integer AS entry_count
    FROM public.task_time_entries
    WHERE duration_minutes > 0
      AND (ended_at IS NOT NULL OR is_manual = true)
    GROUP BY task_id
    UNION ALL
    SELECT task_id, ROUND(SUM(duration * 60))::integer AS actual_minutes, COUNT(*)::integer AS entry_count
    FROM public.time_entries
    WHERE task_id IS NOT NULL
      AND duration > 0
    GROUP BY task_id
  ),
  task_actuals AS (
    SELECT
      t.id,
      t.name,
      t.sop_id,
      t.project_id,
      p.product_id,
      trim(lower(regexp_replace(translate(t.name, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g'))) AS normalized_task_name,
      SUM(a.actual_minutes)::integer AS actual_minutes,
      SUM(a.entry_count)::integer AS entry_count
    FROM public.tasks t
    JOIN actuals a ON a.task_id = t.id
    LEFT JOIN public.projects p ON p.id = t.project_id
    WHERE coalesce(t.name, '') <> ''
    GROUP BY t.id, t.name, t.sop_id, t.project_id, p.product_id
  ),
  scored AS (
    SELECT
      ta.*,
      CASE
        WHEN _sop_id IS NOT NULL AND ta.sop_id = _sop_id THEN 100
        WHEN input.product_id IS NOT NULL AND ta.product_id = input.product_id AND ta.normalized_task_name = input.normalized_name THEN 90
        WHEN ta.normalized_task_name = input.normalized_name THEN 80
        WHEN length(input.normalized_name) >= 4 AND (ta.normalized_task_name LIKE '%' || input.normalized_name || '%' OR input.normalized_name LIKE '%' || ta.normalized_task_name || '%') THEN 60
        ELSE 0
      END AS score
    FROM task_actuals ta
    CROSS JOIN input
  ),
  matches AS (
    SELECT * FROM scored WHERE score >= 60
  )
  SELECT
    ROUND(AVG(actual_minutes))::integer AS avg_minutes,
    COUNT(*)::integer AS sample_count,
    (ARRAY_AGG(name ORDER BY score DESC, actual_minutes DESC))[1] AS matched_task_name,
    CASE
      WHEN MAX(score) >= 90 AND COUNT(*) >= 2 THEN 'alta'
      WHEN MAX(score) >= 80 THEN 'média'
      ELSE 'baixa'
    END AS confidence
  FROM matches
  HAVING COUNT(*) > 0;
$function$;

REVOKE ALL ON FUNCTION public.suggest_task_estimate(text, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suggest_task_estimate(text, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.suggest_task_estimate(text, uuid, uuid, uuid) TO authenticated;