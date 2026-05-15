
-- Portal RPC for recurring occurrences
CREATE OR REPLACE FUNCTION public.get_portal_recurring_occurrences(_token uuid)
RETURNS TABLE(
  id uuid,
  project_id uuid,
  project_name text,
  item_type text,
  name text,
  description text,
  scheduled_date date,
  scheduled_time time,
  status text,
  cycle_index integer,
  sort_order integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT o.id, o.project_id, p.name, o.item_type, o.name, o.description,
         o.scheduled_date, o.scheduled_time, o.status, o.cycle_index, o.sort_order
  FROM public.project_recurring_occurrences o
  JOIN public.projects p ON p.id = o.project_id
  JOIN public.client_portals cp ON cp.client_id = p.client_id
  WHERE cp.token = _token
    AND cp.is_active = true
    AND o.visible_in_portal = true
    AND o.status <> 'cancelada'
    AND p.archived_at IS NULL
  ORDER BY o.scheduled_date, o.scheduled_time NULLS LAST, o.sort_order;
$$;

-- Auto-renewal function: for any project where cycle_renewable=true and we're within 14 days of cycle_end (or past it), extend by cycle_duration_months and regenerate
CREATE OR REPLACE FUNCTION public.renew_recurring_cycles()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  cnt integer := 0;
BEGIN
  FOR rec IN
    SELECT id, cycle_start_date, cycle_duration_months
    FROM public.projects
    WHERE cycle_renewable = true
      AND cycle_duration_months IS NOT NULL
      AND cycle_start_date IS NOT NULL
      AND archived_at IS NULL
      AND (cycle_start_date + (cycle_duration_months || ' months')::interval)::date <= (CURRENT_DATE + INTERVAL '14 days')::date
  LOOP
    UPDATE public.projects
    SET cycle_start_date = (rec.cycle_start_date + (rec.cycle_duration_months || ' months')::interval)::date
    WHERE id = rec.id;
    PERFORM public.generate_cycle_occurrences(rec.id);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$;
