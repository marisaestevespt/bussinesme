-- =====================================================
-- Anti-loop GUC protection for remaining bidirectional sync pairs
-- Pattern: current_setting('app.<key>', true) = 'on' guard + set_config wraps cross-table writes
-- =====================================================

-- ============ MEETING ↔ DELIVERABLE (key: app.meet_deliv_sync) ============

CREATE OR REPLACE FUNCTION public.sync_deliverable_date_to_meeting()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_dt timestamptz;
  _new_dt     timestamptz;
BEGIN
  IF current_setting('app.meet_deliv_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.meeting_id IS NULL OR NEW.is_meeting = false OR NEW.planned_end IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.planned_end IS NOT DISTINCT FROM OLD.planned_end THEN
    RETURN NEW;
  END IF;

  SELECT date_time INTO _current_dt FROM public.meetings WHERE id = NEW.meeting_id;
  IF _current_dt IS NULL THEN RETURN NEW; END IF;

  _new_dt := (NEW.planned_end::text || ' ' || to_char(_current_dt, 'HH24:MI:SSOF'))::timestamptz;

  IF _new_dt IS DISTINCT FROM _current_dt THEN
    PERFORM set_config('app.meet_deliv_sync', 'on', true);
    UPDATE public.meetings
    SET date_time = _new_dt, updated_at = now()
    WHERE id = NEW.meeting_id;
    PERFORM set_config('app.meet_deliv_sync', 'off', true);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_meeting_to_deliverable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.meet_deliv_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'terminada' AND (OLD.status IS DISTINCT FROM 'terminada') AND NEW.project_id IS NOT NULL THEN
    PERFORM set_config('app.meet_deliv_sync', 'on', true);
    UPDATE public.project_deliverables
    SET status = 'concluido', updated_at = now()
    WHERE project_id = NEW.project_id
      AND is_meeting = true
      AND status NOT IN ('concluido','entregue')
      AND (
        lower(NEW.title) LIKE '%' || lower(name) || '%'
        OR lower(name) LIKE '%' || split_part(lower(NEW.title), '|', 1) || '%'
      );
    PERFORM set_config('app.meet_deliv_sync', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_meeting_date_to_deliverable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.meet_deliv_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.date_time IS DISTINCT FROM OLD.date_time AND NEW.date_time IS NOT NULL THEN
    PERFORM set_config('app.meet_deliv_sync', 'on', true);
    UPDATE public.project_deliverables
       SET deadline = (NEW.date_time AT TIME ZONE 'UTC')::date,
           updated_at = now()
     WHERE meeting_id = NEW.id
       AND (deadline IS DISTINCT FROM (NEW.date_time AT TIME ZONE 'UTC')::date);
    UPDATE public.tasks
       SET deadline = (NEW.date_time AT TIME ZONE 'UTC')::date,
           updated_at = now()
     WHERE deliverable_id IN (SELECT id FROM public.project_deliverables WHERE meeting_id = NEW.id)
       AND (deadline IS DISTINCT FROM (NEW.date_time AT TIME ZONE 'UTC')::date);
    PERFORM set_config('app.meet_deliv_sync', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;

-- sync_deliverable_meeting_link is a BEFORE trigger that only mutates NEW; no cross-table write,
-- so no loop risk. Left as-is.

-- ============ ONBOARDING ↔ TASK (key: app.onb_task_sync) ============

CREATE OR REPLACE FUNCTION public.sync_onboarding_to_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _assignee uuid;
  _existing_task uuid;
BEGIN
  IF current_setting('app.onb_task_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT profile_id INTO _assignee FROM public.team_members WHERE id = NEW.member_id;

  PERFORM set_config('app.onb_task_sync', 'on', true);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tasks (name, status, priority, deadline, assigned_to, tag, onboarding_id)
    VALUES (
      NEW.task,
      CASE WHEN NEW.completed THEN 'done' ELSE 'por_comecar' END,
      'media',
      NEW.deadline_date,
      _assignee,
      'Onboarding',
      NEW.id
    );
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT id INTO _existing_task FROM public.tasks WHERE onboarding_id = NEW.id LIMIT 1;
    IF _existing_task IS NULL THEN
      INSERT INTO public.tasks (name, status, priority, deadline, assigned_to, tag, onboarding_id)
      VALUES (
        NEW.task,
        CASE WHEN NEW.completed THEN 'done' ELSE 'por_comecar' END,
        'media', NEW.deadline_date, _assignee, 'Onboarding', NEW.id
      );
    ELSE
      UPDATE public.tasks
      SET name = NEW.task,
          deadline = NEW.deadline_date,
          status = CASE
            WHEN NEW.completed AND status <> 'done' THEN 'done'
            WHEN NOT NEW.completed AND status = 'done' THEN 'por_comecar'
            ELSE status
          END,
          assigned_to = COALESCE(assigned_to, _assignee),
          updated_at = now()
      WHERE id = _existing_task;
    END IF;
  END IF;

  PERFORM set_config('app.onb_task_sync', 'off', true);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_task_status_to_onboarding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.onb_task_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.onboarding_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM set_config('app.onb_task_sync', 'on', true);
    UPDATE public.member_onboarding
    SET completed = (NEW.status = 'done')
    WHERE id = NEW.onboarding_id
      AND completed IS DISTINCT FROM (NEW.status = 'done');
    PERFORM set_config('app.onb_task_sync', 'off', true);
  END IF;
  RETURN NEW;
END;
$function$;
