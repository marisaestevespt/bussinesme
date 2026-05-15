
-- ============================================================
-- 1) Forward sync: occurrence -> task / meeting
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_occurrence_to_task_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proj record;
  _item record;
  _new_task_id uuid;
  _new_meeting_id uuid;
  _task_status text;
  _meeting_status meeting_status;
BEGIN
  -- Avoid recursion when this trigger fires from within a sibling trigger
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  SELECT id, client_id, department, product_id, name
    INTO _proj FROM public.projects WHERE id = NEW.project_id;
  IF _proj.id IS NULL THEN RETURN NEW; END IF;

  SELECT default_responsible_role, duration_minutes
    INTO _item FROM public.product_recurring_items WHERE id = NEW.source_recurring_item_id;

  -- Map occurrence status to downstream
  _task_status := CASE NEW.status
    WHEN 'concluida' THEN 'done'
    WHEN 'cancelada' THEN 'done'
    ELSE 'por_comecar'
  END;
  _meeting_status := CASE NEW.status
    WHEN 'concluida' THEN 'realizada'::meeting_status
    WHEN 'cancelada' THEN 'cancelada'::meeting_status
    WHEN 'reagendada' THEN 'por_organizar'::meeting_status
    ELSE 'por_organizar'::meeting_status
  END;

  -- ===== MEETING branch (item_type = reuniao) =====
  IF NEW.item_type = 'reuniao' THEN
    IF NEW.linked_meeting_id IS NULL THEN
      INSERT INTO public.meetings (
        title, date_time, duration_minutes, project_id, project_name,
        client_id, department, status, meeting_type, visible_in_portal
      ) VALUES (
        NEW.name,
        ((NEW.scheduled_date::timestamp + COALESCE(NEW.scheduled_time, TIME '10:00')) AT TIME ZONE 'UTC'),
        COALESCE(NEW.duration_minutes, _item.duration_minutes, 60),
        NEW.project_id, _proj.name, _proj.client_id, _proj.department,
        _meeting_status, 'cliente', COALESCE(NEW.visible_in_portal, false)
      ) RETURNING id INTO _new_meeting_id;
      NEW.linked_meeting_id := _new_meeting_id;
    ELSE
      -- propagate updates to existing meeting
      UPDATE public.meetings
         SET title = NEW.name,
             date_time = ((NEW.scheduled_date::timestamp + COALESCE(NEW.scheduled_time, TIME '10:00')) AT TIME ZONE 'UTC'),
             duration_minutes = COALESCE(NEW.duration_minutes, duration_minutes),
             status = _meeting_status,
             visible_in_portal = COALESCE(NEW.visible_in_portal, visible_in_portal)
       WHERE id = NEW.linked_meeting_id;
    END IF;

  -- ===== TASK branch (item_type = tarefa | entrega) =====
  ELSE
    IF NEW.linked_task_id IS NULL THEN
      INSERT INTO public.tasks (
        name, status, priority, project_id, client_id, department,
        deadline, scheduled_time, visible_in_portal,
        notes, tag, estimated_minutes
      ) VALUES (
        NEW.name, _task_status, 'media', NEW.project_id, _proj.client_id, _proj.department,
        NEW.scheduled_date,
        CASE WHEN NEW.scheduled_time IS NOT NULL THEN to_char(NEW.scheduled_time, 'HH24:MI') ELSE NULL END,
        COALESCE(NEW.visible_in_portal, false),
        NEW.description,
        CASE WHEN NEW.item_type = 'entrega' THEN 'entrega-recorrente' ELSE 'tarefa-recorrente' END,
        COALESCE(NEW.duration_minutes, _item.duration_minutes)
      ) RETURNING id INTO _new_task_id;
      NEW.linked_task_id := _new_task_id;
    ELSE
      UPDATE public.tasks
         SET name = NEW.name,
             status = _task_status,
             deadline = NEW.scheduled_date,
             scheduled_time = CASE WHEN NEW.scheduled_time IS NOT NULL THEN to_char(NEW.scheduled_time, 'HH24:MI') ELSE NULL END,
             visible_in_portal = COALESCE(NEW.visible_in_portal, visible_in_portal),
             notes = NEW.description,
             estimated_minutes = COALESCE(NEW.duration_minutes, estimated_minutes)
       WHERE id = NEW.linked_task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_occurrence_sync_forward ON public.project_recurring_occurrences;
CREATE TRIGGER trg_occurrence_sync_forward
BEFORE INSERT OR UPDATE OF name, scheduled_date, scheduled_time, status, visible_in_portal, duration_minutes, description
ON public.project_recurring_occurrences
FOR EACH ROW EXECUTE FUNCTION public.sync_occurrence_to_task_meeting();

-- ============================================================
-- 2) Reverse sync: task -> occurrence
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_task_to_occurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_status text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  _new_status := CASE NEW.status WHEN 'done' THEN 'concluida' ELSE 'pendente' END;

  UPDATE public.project_recurring_occurrences
     SET status = _new_status,
         scheduled_date = COALESCE(NEW.deadline, scheduled_date),
         name = NEW.name
   WHERE linked_task_id = NEW.id
     AND (status IS DISTINCT FROM _new_status
          OR scheduled_date IS DISTINCT FROM COALESCE(NEW.deadline, scheduled_date)
          OR name IS DISTINCT FROM NEW.name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_sync_to_occurrence ON public.tasks;
CREATE TRIGGER trg_task_sync_to_occurrence
AFTER UPDATE OF status, deadline, name ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_to_occurrence();

-- ============================================================
-- 3) Reverse sync: meeting -> occurrence
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_meeting_to_occurrence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_status text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  _new_status := CASE NEW.status::text
    WHEN 'realizada' THEN 'concluida'
    WHEN 'cancelada' THEN 'cancelada'
    WHEN 'terminada' THEN 'concluida'
    ELSE 'pendente'
  END;

  UPDATE public.project_recurring_occurrences
     SET status = _new_status,
         scheduled_date = (NEW.date_time AT TIME ZONE 'UTC')::date,
         scheduled_time = (NEW.date_time AT TIME ZONE 'UTC')::time,
         name = NEW.title
   WHERE linked_meeting_id = NEW.id
     AND (status IS DISTINCT FROM _new_status
          OR scheduled_date IS DISTINCT FROM (NEW.date_time AT TIME ZONE 'UTC')::date
          OR name IS DISTINCT FROM NEW.title);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meeting_sync_to_occurrence ON public.meetings;
CREATE TRIGGER trg_meeting_sync_to_occurrence
AFTER UPDATE OF status, date_time, title ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.sync_meeting_to_occurrence();

-- ============================================================
-- 4) Cleanup on occurrence delete: remove linked task/meeting
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_occurrence_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.linked_task_id IS NOT NULL THEN
    DELETE FROM public.tasks WHERE id = OLD.linked_task_id;
  END IF;
  IF OLD.linked_meeting_id IS NOT NULL THEN
    DELETE FROM public.meetings WHERE id = OLD.linked_meeting_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_occurrence_cleanup ON public.project_recurring_occurrences;
CREATE TRIGGER trg_occurrence_cleanup
BEFORE DELETE ON public.project_recurring_occurrences
FOR EACH ROW EXECUTE FUNCTION public.cleanup_occurrence_links();

-- ============================================================
-- 5) Backfill: create task/meeting for existing orphan occurrences
-- ============================================================
DO $$
DECLARE
  _occ record;
  _proj record;
  _item record;
  _new_id uuid;
BEGIN
  FOR _occ IN
    SELECT * FROM public.project_recurring_occurrences
    WHERE (item_type = 'reuniao' AND linked_meeting_id IS NULL)
       OR (item_type IN ('tarefa','entrega') AND linked_task_id IS NULL)
  LOOP
    SELECT id, client_id, department, name INTO _proj
      FROM public.projects WHERE id = _occ.project_id;
    IF _proj.id IS NULL THEN CONTINUE; END IF;

    SELECT default_responsible_role, duration_minutes INTO _item
      FROM public.product_recurring_items WHERE id = _occ.source_recurring_item_id;

    IF _occ.item_type = 'reuniao' THEN
      INSERT INTO public.meetings (
        title, date_time, duration_minutes, project_id, project_name,
        client_id, department, status, meeting_type, visible_in_portal
      ) VALUES (
        _occ.name,
        ((_occ.scheduled_date::timestamp + COALESCE(_occ.scheduled_time, TIME '10:00')) AT TIME ZONE 'UTC'),
        COALESCE(_occ.duration_minutes, _item.duration_minutes, 60),
        _occ.project_id, _proj.name, _proj.client_id, _proj.department,
        CASE _occ.status WHEN 'concluida' THEN 'realizada'::meeting_status
                          WHEN 'cancelada' THEN 'cancelada'::meeting_status
                          ELSE 'por_organizar'::meeting_status END,
        'cliente', COALESCE(_occ.visible_in_portal, false)
      ) RETURNING id INTO _new_id;
      UPDATE public.project_recurring_occurrences SET linked_meeting_id = _new_id WHERE id = _occ.id;
    ELSE
      INSERT INTO public.tasks (
        name, status, priority, project_id, client_id, department,
        deadline, scheduled_time, visible_in_portal, notes, tag, estimated_minutes
      ) VALUES (
        _occ.name,
        CASE _occ.status WHEN 'concluida' THEN 'done' WHEN 'cancelada' THEN 'done' ELSE 'por_comecar' END,
        'media', _occ.project_id, _proj.client_id, _proj.department,
        _occ.scheduled_date,
        CASE WHEN _occ.scheduled_time IS NOT NULL THEN to_char(_occ.scheduled_time, 'HH24:MI') ELSE NULL END,
        COALESCE(_occ.visible_in_portal, false),
        _occ.description,
        CASE WHEN _occ.item_type = 'entrega' THEN 'entrega-recorrente' ELSE 'tarefa-recorrente' END,
        COALESCE(_occ.duration_minutes, _item.duration_minutes)
      ) RETURNING id INTO _new_id;
      UPDATE public.project_recurring_occurrences SET linked_task_id = _new_id WHERE id = _occ.id;
    END IF;
  END LOOP;
END$$;
