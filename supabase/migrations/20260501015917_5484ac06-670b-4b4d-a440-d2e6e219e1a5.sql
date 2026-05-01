-- Índice único restrito apenas ao tipo meeting_missing_link (evita conflito com dados pré-existentes de outros tipos)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_meeting_missing_link_dedup_unique
  ON public.notifications (user_id, dedup_key)
  WHERE dedup_key IS NOT NULL AND type = 'meeting_missing_link';

-- Helper: adiciona N horas úteis (salta sábados/domingos)
CREATE OR REPLACE FUNCTION public.add_business_hours(_from timestamptz, _hours int)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _cur timestamptz := _from;
  _remaining int := _hours;
BEGIN
  WHILE _remaining > 0 LOOP
    _cur := _cur + interval '1 hour';
    IF EXTRACT(ISODOW FROM _cur) BETWEEN 1 AND 5 THEN
      _remaining := _remaining - 1;
    END IF;
  END LOOP;
  RETURN _cur;
END;
$$;

-- Função principal
CREATE OR REPLACE FUNCTION public.notify_meetings_missing_link()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _window_end timestamptz;
  _now timestamptz := now();
  _meeting RECORD;
  _owner_user_id uuid;
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

    FOR _owner_user_id IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'owner'
    LOOP
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, message, link, dedup_key)
        VALUES (
          _owner_user_id,
          'meeting_missing_link',
          _title,
          _msg,
          '/hub/reunioes/' || _meeting.id::text,
          _dedup
        );
        _inserted := _inserted + 1;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  RETURN _inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_meetings_missing_link() TO service_role;