
-- ============================================================================
-- A+C: Add source columns to time_entries so triggers can upsert idempotently
-- ============================================================================
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS source_timer_id uuid,
  ADD COLUMN IF NOT EXISTS source_meeting_id uuid,
  ADD COLUMN IF NOT EXISTS source_participant_profile uuid;

-- Unique indexes for idempotent upserts (allow many NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_time_entries_source_timer
  ON public.time_entries (source_timer_id) WHERE source_timer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_time_entries_source_meeting_participant
  ON public.time_entries (source_meeting_id, source_participant_profile)
  WHERE source_meeting_id IS NOT NULL AND source_participant_profile IS NOT NULL;

-- ============================================================================
-- Helper: resolve team_member.id from auth.user_id via profiles
-- ============================================================================
CREATE OR REPLACE FUNCTION public.member_id_from_user(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT tm.id
    FROM public.team_members tm
    JOIN public.profiles p ON p.id = tm.profile_id
   WHERE p.user_id = _user_id
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.member_id_from_profile(_profile_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.team_members WHERE profile_id = _profile_id LIMIT 1;
$$;

-- ============================================================================
-- A: task_time_entries -> time_entries sync
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_task_timer_to_time_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _task record;
  _member_id uuid;
  _entry_date date;
  _category text;
  _hours numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.time_entries WHERE source_timer_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Only sync once the timer has actually closed (ended) or is a manual entry
  IF NEW.ended_at IS NULL AND NOT NEW.is_manual THEN
    DELETE FROM public.time_entries WHERE source_timer_id = NEW.id;
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.duration_minutes, 0) <= 0 THEN
    DELETE FROM public.time_entries WHERE source_timer_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id, name, client_id, project_id, department, deadline
    INTO _task FROM public.tasks WHERE id = NEW.task_id;

  _member_id := public.member_id_from_user(NEW.user_id);
  _entry_date := COALESCE(NEW.ended_at::date, NEW.started_at::date, CURRENT_DATE);
  _category := CASE WHEN _task.client_id IS NOT NULL THEN 'cliente' ELSE 'interno' END;
  _hours := ROUND((NEW.duration_minutes::numeric / 60.0)::numeric, 2);

  INSERT INTO public.time_entries (
    entry_date, member_id, duration, category,
    task_id, project_id, client_id, description,
    source_timer_id
  ) VALUES (
    _entry_date, _member_id, _hours, _category,
    NEW.task_id, _task.project_id, _task.client_id,
    COALESCE(NEW.note, _task.name),
    NEW.id
  )
  ON CONFLICT (source_timer_id) WHERE source_timer_id IS NOT NULL
  DO UPDATE SET
    entry_date = EXCLUDED.entry_date,
    member_id = EXCLUDED.member_id,
    duration = EXCLUDED.duration,
    category = EXCLUDED.category,
    task_id = EXCLUDED.task_id,
    project_id = EXCLUDED.project_id,
    client_id = EXCLUDED.client_id,
    description = EXCLUDED.description,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_timer_to_time_entry ON public.task_time_entries;
CREATE TRIGGER trg_sync_task_timer_to_time_entry
AFTER INSERT OR UPDATE OR DELETE ON public.task_time_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_task_timer_to_time_entry();

-- ============================================================================
-- B: Default actual_duration_minutes when meeting is marked done
-- ============================================================================
CREATE OR REPLACE FUNCTION public.default_meeting_actual_duration()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('realizada','terminada','confirmada')
     AND NEW.actual_duration_minutes IS NULL THEN
    NEW.actual_duration_minutes := COALESCE(NEW.planned_duration_minutes, NEW.duration_minutes);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_meeting_actual_duration ON public.meetings;
CREATE TRIGGER trg_default_meeting_actual_duration
BEFORE INSERT OR UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.default_meeting_actual_duration();

-- ============================================================================
-- C: meetings + meeting_participants -> time_entries sync
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_meeting_time_entries(_meeting_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _m record;
  _hours numeric;
  _entry_date date;
  _member_id uuid;
  _part record;
BEGIN
  SELECT id, title, date_time, status, actual_duration_minutes, planned_duration_minutes,
         duration_minutes, project_id, client_id, department
    INTO _m FROM public.meetings WHERE id = _meeting_id;

  IF _m.id IS NULL THEN
    DELETE FROM public.time_entries WHERE source_meeting_id = _meeting_id;
    RETURN;
  END IF;

  -- Only count "real" meetings
  IF _m.status NOT IN ('realizada','terminada','confirmada') THEN
    DELETE FROM public.time_entries WHERE source_meeting_id = _meeting_id;
    RETURN;
  END IF;

  _hours := ROUND(
    (COALESCE(_m.actual_duration_minutes, _m.planned_duration_minutes, _m.duration_minutes, 0)::numeric / 60.0)::numeric,
    2
  );

  IF _hours <= 0 THEN
    DELETE FROM public.time_entries WHERE source_meeting_id = _meeting_id;
    RETURN;
  END IF;

  _entry_date := _m.date_time::date;

  -- Remove entries for participants no longer in the meeting
  DELETE FROM public.time_entries
   WHERE source_meeting_id = _meeting_id
     AND source_participant_profile NOT IN (
       SELECT profile_id FROM public.meeting_participants WHERE meeting_id = _meeting_id
     );

  -- Upsert one entry per participant that maps to a team member
  FOR _part IN
    SELECT profile_id FROM public.meeting_participants WHERE meeting_id = _meeting_id
  LOOP
    _member_id := public.member_id_from_profile(_part.profile_id);
    IF _member_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.time_entries (
      entry_date, member_id, duration, category,
      project_id, client_id, description,
      source_meeting_id, source_participant_profile
    ) VALUES (
      _entry_date, _member_id, _hours, 'reuniao',
      _m.project_id, _m.client_id,
      'Reunião: ' || _m.title,
      _meeting_id, _part.profile_id
    )
    ON CONFLICT (source_meeting_id, source_participant_profile)
      WHERE source_meeting_id IS NOT NULL AND source_participant_profile IS NOT NULL
    DO UPDATE SET
      entry_date = EXCLUDED.entry_date,
      member_id = EXCLUDED.member_id,
      duration = EXCLUDED.duration,
      project_id = EXCLUDED.project_id,
      client_id = EXCLUDED.client_id,
      description = EXCLUDED.description,
      updated_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_meeting_to_time_entries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.time_entries WHERE source_meeting_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM public.upsert_meeting_time_entries(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meeting_to_time_entries ON public.meetings;
CREATE TRIGGER trg_sync_meeting_to_time_entries
AFTER INSERT OR UPDATE OF status, actual_duration_minutes, planned_duration_minutes,
                          duration_minutes, date_time, project_id, client_id, title
                       OR DELETE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.sync_meeting_to_time_entries();

CREATE OR REPLACE FUNCTION public.sync_meeting_participant_to_time_entries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.upsert_meeting_time_entries(OLD.meeting_id);
    RETURN OLD;
  END IF;
  PERFORM public.upsert_meeting_time_entries(NEW.meeting_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_meeting_participant_to_time_entries ON public.meeting_participants;
CREATE TRIGGER trg_sync_meeting_participant_to_time_entries
AFTER INSERT OR UPDATE OR DELETE ON public.meeting_participants
FOR EACH ROW EXECUTE FUNCTION public.sync_meeting_participant_to_time_entries();

-- ============================================================================
-- E: Backfill
-- ============================================================================
-- A: replay existing timers
UPDATE public.task_time_entries SET ended_at = ended_at WHERE ended_at IS NOT NULL OR is_manual;

-- B: backfill actual_duration_minutes on already-done meetings
UPDATE public.meetings
   SET actual_duration_minutes = COALESCE(planned_duration_minutes, duration_minutes)
 WHERE status IN ('realizada','terminada','confirmada')
   AND actual_duration_minutes IS NULL;

-- C: replay all done meetings to populate time_entries
DO $$
DECLARE _id uuid;
BEGIN
  FOR _id IN SELECT id FROM public.meetings WHERE status IN ('realizada','terminada','confirmada') LOOP
    PERFORM public.upsert_meeting_time_entries(_id);
  END LOOP;
END $$;
