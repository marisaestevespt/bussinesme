CREATE OR REPLACE FUNCTION public.refresh_absence_coverage_status()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.absence_coverage
  SET status = CASE
    WHEN start_date > CURRENT_DATE THEN 'agendada'
    WHEN end_date   < CURRENT_DATE THEN 'terminada'
    ELSE 'ativa'
  END
  WHERE status IS DISTINCT FROM CASE
    WHEN start_date > CURRENT_DATE THEN 'agendada'
    WHEN end_date   < CURRENT_DATE THEN 'terminada'
    ELSE 'ativa'
  END;
$$;