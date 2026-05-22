-- Only meetings with status realizada/terminada count as worked hours.
-- 'confirmada' is treated as planned, not done.

CREATE OR REPLACE FUNCTION public.default_meeting_actual_duration()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('realizada','terminada')
     AND NEW.actual_duration_minutes IS NULL THEN
    NEW.actual_duration_minutes := COALESCE(NEW.planned_duration_minutes, NEW.duration_minutes);
  END IF;
  RETURN NEW;
END;
$$;

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

  -- Only count actually-done meetings (confirmada is planned, not done)
  IF _m.status NOT IN ('realizada','terminada') THEN
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

  DELETE FROM public.time_entries
   WHERE source_meeting_id = _meeting_id
     AND source_participant_profile NOT IN (
       SELECT profile_id FROM public.meeting_participants WHERE meeting_id = _meeting_id
     );

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

-- Cleanup: remove time_entries created for meetings that are only 'confirmada'
DELETE FROM public.time_entries
 WHERE source_meeting_id IN (
   SELECT id FROM public.meetings
    WHERE status::text NOT IN ('realizada','terminada')
 );