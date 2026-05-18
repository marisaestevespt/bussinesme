
CREATE OR REPLACE FUNCTION public.generate_cycle_occurrences(_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _proj record;
  _item record;
  _cycle_end date;
  _date date;
  _effective_day int;
  _inserted int := 0;
  _skipped int := 0;
BEGIN
  SELECT id, product_id, cycle_duration_months, cycle_start_date, start_date
    INTO _proj
    FROM public.projects WHERE id = _project_id;

  IF _proj.product_id IS NULL THEN
    RETURN jsonb_build_object('error','project has no product');
  END IF;

  IF _proj.cycle_duration_months IS NULL OR _proj.cycle_duration_months <= 0 THEN
    RETURN jsonb_build_object('error','project has no cycle_duration_months');
  END IF;

  _cycle_end := COALESCE(_proj.cycle_start_date, _proj.start_date, CURRENT_DATE)
                + (_proj.cycle_duration_months || ' months')::interval - INTERVAL '1 day';

  FOR _item IN
    SELECT ri.*, ph.cycle_day_start AS phase_day_start
    FROM public.product_recurring_items ri
    LEFT JOIN public.product_phases ph ON ph.id = ri.phase_id
    WHERE ri.product_id = _proj.product_id
    ORDER BY ri.sort_order
  LOOP
    _date := COALESCE(_proj.cycle_start_date, _proj.start_date, CURRENT_DATE);

    -- Para semanal/quinzenal: avançar até ao primeiro dia da semana correto
    IF _item.frequency IN ('semanal','quinzenal') AND _item.day_of_week IS NOT NULL THEN
      WHILE EXTRACT(DOW FROM _date)::int <> _item.day_of_week LOOP
        _date := _date + INTERVAL '1 day';
      END LOOP;
    END IF;

    -- Para mensal/trimestral: dia do item OU, se não tiver, dia início da fase
    IF _item.frequency IN ('mensal','trimestral') THEN
      _effective_day := COALESCE(_item.day_of_month, _item.phase_day_start);
      IF _effective_day IS NOT NULL THEN
        _date := date_trunc('month', _date)::date
                + (LEAST(_effective_day, EXTRACT(DAY FROM (date_trunc('month', _date) + INTERVAL '1 month - 1 day'))::int) - 1);
        IF _date < COALESCE(_proj.cycle_start_date, _proj.start_date, CURRENT_DATE) THEN
          _date := _date + INTERVAL '1 month';
        END IF;
      END IF;
    END IF;

    -- Loop até ao fim do ciclo
    WHILE _date <= _cycle_end LOOP
      BEGIN
        INSERT INTO public.project_recurring_occurrences (
          project_id, source_recurring_item_id, item_type, name, description,
          scheduled_date, scheduled_time, duration_minutes, visible_in_portal, sort_order
        ) VALUES (
          _project_id, _item.id, _item.item_type, _item.name, _item.description,
          _date, _item.scheduled_time, _item.duration_minutes, _item.visible_in_portal, _item.sort_order
        );
        _inserted := _inserted + 1;
      EXCEPTION WHEN unique_violation THEN
        _skipped := _skipped + 1;
      END;

      _date := CASE _item.frequency
        WHEN 'semanal' THEN _date + INTERVAL '7 days'
        WHEN 'quinzenal' THEN _date + INTERVAL '14 days'
        WHEN 'mensal' THEN _date + INTERVAL '1 month'
        WHEN 'trimestral' THEN _date + INTERVAL '3 months'
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('inserted', _inserted, 'skipped', _skipped);
END;
$function$;
