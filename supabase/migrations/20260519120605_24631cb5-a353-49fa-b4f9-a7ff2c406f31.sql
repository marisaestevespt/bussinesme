CREATE OR REPLACE FUNCTION public.sync_task_timer_to_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_client uuid;
  v_member uuid;
  v_minutes int;
  v_hours numeric;
  v_entry_date date;
  v_category text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.time_entries WHERE source_timer_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT t.id, t.name, t.client_id, t.project_id, p.client_id AS project_client_id
    INTO v_task
  FROM public.tasks t
  LEFT JOIN public.projects p ON p.id = t.project_id
  WHERE t.id = NEW.task_id;

  v_client := COALESCE(v_task.client_id, v_task.project_client_id);
  v_category := CASE WHEN v_client IS NOT NULL THEN 'cliente' ELSE 'interno' END;
  v_minutes := COALESCE(NEW.duration_minutes, 0);
  IF v_minutes <= 0 THEN RETURN NEW; END IF;
  v_hours := ROUND((v_minutes::numeric / 60.0), 2);
  v_entry_date := COALESCE(NEW.ended_at::date, NEW.started_at::date, CURRENT_DATE);
  v_member := public.member_id_from_user(NEW.user_id);

  INSERT INTO public.time_entries (
    source_timer_id, member_id, entry_date, duration,
    category, task_id, project_id, client_id, description
  ) VALUES (
    NEW.id, v_member, v_entry_date, v_hours,
    v_category, NEW.task_id, v_task.project_id, v_client,
    COALESCE(NEW.notes, 'Timer: ' || v_task.name)
  )
  ON CONFLICT (source_timer_id) DO UPDATE SET
    member_id = EXCLUDED.member_id,
    entry_date = EXCLUDED.entry_date,
    duration = EXCLUDED.duration,
    category = EXCLUDED.category,
    task_id = EXCLUDED.task_id,
    project_id = EXCLUDED.project_id,
    client_id = EXCLUDED.client_id,
    description = EXCLUDED.description;

  RETURN NEW;
END;
$$;

-- Backfill existing entries that have project_id but no client_id
UPDATE public.time_entries te
SET client_id = p.client_id,
    category = CASE WHEN p.client_id IS NOT NULL THEN 'cliente' ELSE te.category END
FROM public.projects p
WHERE te.project_id = p.id
  AND te.client_id IS NULL
  AND p.client_id IS NOT NULL;