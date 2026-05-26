
CREATE OR REPLACE FUNCTION public.notify_meetings_missing_link()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _window_end timestamptz;
  _now timestamptz := now();
  _meeting RECORD;
  _owner_profile_id uuid;
  _inserted int := 0;
  _dedup text;
  _title text;
  _msg text;
BEGIN
  _window_end := public.add_business_hours(_now, 48);

  FOR _meeting IN
    SELECT m.id, m.title, m.date_time, m.client_name
    FROM public.meetings m
    WHERE m.date_time > _now
      AND m.date_time <= _window_end
      AND (m.meeting_url IS NULL OR btrim(m.meeting_url) = '')
      AND COALESCE(m.with_meet, false) = false
      AND m.status IN ('por_confirmar', 'confirmada')
  LOOP
    _dedup := 'missing_link:' || _meeting.id::text;
    _title := '⚠️ Reunião sem link em menos de 48h';
    _msg := COALESCE(_meeting.title, 'Reunião sem título')
            || COALESCE(' · ' || _meeting.client_name, '')
            || ' — falta adicionar o link da reunião.';

    FOR _owner_profile_id IN
      SELECT p.id
      FROM public.user_roles ur
      JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = 'owner'
    LOOP
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, message, link, dedup_key)
        VALUES (
          _owner_profile_id,
          'meeting_missing_link',
          _title,
          _msg,
          '/hub/reunioes/' || _meeting.id::text,
          _dedup
        );
        _inserted := _inserted + 1;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      WHEN foreign_key_violation THEN
        -- defensivo: ignora owners sem profile em vez de rebentar o cron
        NULL;
      END;
    END LOOP;
  END LOOP;

  RETURN _inserted;
END;
$function$;
