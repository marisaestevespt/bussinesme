-- 1) Occurrence -> Meeting: treat scheduled_time as Europe/Lisbon wall clock
CREATE OR REPLACE FUNCTION public.sync_occurrence_to_task_meeting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _proj record;
  _item record;
  _new_task_id uuid;
  _new_meeting_id uuid;
  _task_status text;
  _meeting_status meeting_status;
  _new_dt timestamptz;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  SELECT id, client_id, department, product_id, name
    INTO _proj FROM public.projects WHERE id = NEW.project_id;
  IF _proj.id IS NULL THEN RETURN NEW; END IF;

  SELECT default_responsible_role, duration_minutes
    INTO _item FROM public.product_recurring_items WHERE id = NEW.source_recurring_item_id;

  _task_status := CASE NEW.status
    WHEN 'concluida' THEN 'done'
    WHEN 'cancelada' THEN 'done'
    ELSE 'por_comecar'
  END;
  _meeting_status := CASE NEW.status
    WHEN 'concluida'  THEN 'realizada'::meeting_status
    WHEN 'cancelada'  THEN 'cancelada'::meeting_status
    WHEN 'reagendada' THEN 'por_confirmar'::meeting_status
    ELSE 'por_confirmar'::meeting_status
  END;

  _new_dt := ((NEW.scheduled_date::timestamp + COALESCE(NEW.scheduled_time, TIME '10:00')) AT TIME ZONE 'Europe/Lisbon');

  IF NEW.item_type = 'reuniao' THEN
    IF NEW.linked_meeting_id IS NULL THEN
      INSERT INTO public.meetings (
        title, date_time, duration_minutes, project_id, project_name,
        client_id, department, status, meeting_type, visible_in_portal
      ) VALUES (
        NEW.name,
        _new_dt,
        COALESCE(NEW.duration_minutes, _item.duration_minutes, 60),
        NEW.project_id, _proj.name, _proj.client_id, _proj.department,
        _meeting_status, 'cliente', COALESCE(NEW.visible_in_portal, false)
      ) RETURNING id INTO _new_meeting_id;
      NEW.linked_meeting_id := _new_meeting_id;
    ELSE
      UPDATE public.meetings
         SET title = NEW.name,
             date_time = _new_dt,
             duration_minutes = COALESCE(NEW.duration_minutes, duration_minutes),
             status = CASE
               WHEN status IN ('realizada','terminada','cancelada','confirmada') THEN status
               ELSE _meeting_status
             END,
             visible_in_portal = COALESCE(NEW.visible_in_portal, visible_in_portal)
       WHERE id = NEW.linked_meeting_id;
    END IF;

  ELSE
    IF NEW.linked_task_id IS NULL THEN
      INSERT INTO public.tasks (
        name, status, priority, project_id, client_id, department,
        deadline, visible_in_portal,
        notes, tag, estimated_minutes
      ) VALUES (
        NEW.name, _task_status, 'media', NEW.project_id, _proj.client_id, _proj.department,
        NEW.scheduled_date,
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
             visible_in_portal = COALESCE(NEW.visible_in_portal, visible_in_portal),
             notes = NEW.description,
             estimated_minutes = COALESCE(NEW.duration_minutes, estimated_minutes)
       WHERE id = NEW.linked_task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) Meeting -> Occurrence: convert date_time from UTC to Europe/Lisbon wall clock
CREATE OR REPLACE FUNCTION public.sync_meeting_to_occurrence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_status text;
  _local_ts timestamp;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  _new_status := CASE NEW.status::text
    WHEN 'realizada' THEN 'concluida'
    WHEN 'cancelada' THEN 'cancelada'
    WHEN 'terminada' THEN 'concluida'
    ELSE 'pendente'
  END;

  _local_ts := (NEW.date_time AT TIME ZONE 'Europe/Lisbon');

  UPDATE public.project_recurring_occurrences
     SET status = _new_status,
         scheduled_date = _local_ts::date,
         scheduled_time = _local_ts::time,
         name = NEW.title
   WHERE linked_meeting_id = NEW.id
     AND (status IS DISTINCT FROM _new_status
          OR scheduled_date IS DISTINCT FROM _local_ts::date
          OR scheduled_time IS DISTINCT FROM _local_ts::time
          OR name IS DISTINCT FROM NEW.title);

  RETURN NEW;
END;
$function$;