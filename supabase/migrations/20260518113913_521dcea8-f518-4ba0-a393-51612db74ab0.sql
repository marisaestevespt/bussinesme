CREATE OR REPLACE FUNCTION public.admin_top_queries(_limit int DEFAULT 20)
RETURNS TABLE (
  total_ms numeric,
  calls bigint,
  mean_ms numeric,
  rows bigint,
  query_preview text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    round(s.total_exec_time::numeric, 1) AS total_ms,
    s.calls,
    round(s.mean_exec_time::numeric, 2) AS mean_ms,
    s.rows,
    LEFT(regexp_replace(s.query, '\s+', ' ', 'g'), 240) AS query_preview
  FROM extensions.pg_stat_statements s
  WHERE s.query ILIKE '%public.%'
    AND s.query NOT ILIKE '%pg_stat_%'
    AND s.query NOT ILIKE '%pg_catalog%'
  ORDER BY s.total_exec_time DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_top_queries(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_top_queries(int) TO authenticated;