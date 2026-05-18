CREATE OR REPLACE FUNCTION public.generate_cycle_occurrences(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _proj record;
  _item record;
  _cycle_start date;
  _cycle_end date;
  _date date;
  _month_cursor date;
  _month_last_day int;
  _effective_day int;
  _first_dow date;
  _inserted int := 0;
  _skipped int := 0;
BEGIN
  SELECT id, product_id, cycle_duration_months, cycle_start_date, start_date
    INTO _proj
    FROM public.projects
   WHERE id = _project_id;

  IF _proj.product_id IS NULL THEN
    RETURN jsonb_build_object('error','project has no product');
  END IF;

  IF _proj.cycle_duration_months IS NULL OR _proj.cycle_duration_months <= 0 THEN
    RETURN jsonb_build_object('error','project has no cycle_duration_months');
  END IF;

  _cycle_start := COALESCE(_proj.cycle_start_date, _proj.start_date, CURRENT_DATE);
  _cycle_end := _cycle_start + (_proj.cycle_duration_months || ' months')::interval - INTERVAL '1 day';

  FOR _item IN
    SELECT ri.*, ph.cycle_day_start AS phase_day_start
      FROM public.product_recurring_items ri
      LEFT JOIN public.product_phases ph ON ph.id = ri.phase_id
     WHERE ri.product_id = _proj.product_id
     ORDER BY ri.sort_order
  LOOP
    IF _item.frequency IN ('semanal','quinzenal') THEN
      _date := _cycle_start;

      IF _item.day_of_week IS NOT NULL THEN
        WHILE EXTRACT(DOW FROM _date)::int <> _item.day_of_week LOOP
          _date := _date + INTERVAL '1 day';
        END LOOP;
      END IF;

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
          ELSE _date + INTERVAL '14 days'
        END;
      END LOOP;
    END IF;

    IF _item.frequency IN ('mensal','trimestral') THEN
      _month_cursor := date_trunc('month', _cycle_start)::date;

      WHILE _month_cursor <= _cycle_end LOOP
        _month_last_day := EXTRACT(DAY FROM (_month_cursor + INTERVAL '1 month - 1 day'))::int;

        IF _item.day_of_month IS NOT NULL THEN
          _effective_day := LEAST(_item.day_of_month, _month_last_day);
          _date := _month_cursor + (_effective_day - 1);
        ELSIF _item.day_of_week IS NOT NULL AND _item.week_of_month IS NOT NULL THEN
          _first_dow := _month_cursor;
          WHILE EXTRACT(DOW FROM _first_dow)::int <> _item.day_of_week LOOP
            _first_dow := _first_dow + INTERVAL '1 day';
          END LOOP;
          _date := _first_dow + ((GREATEST(_item.week_of_month, 1) - 1) * 7);
          WHILE date_trunc('month', _date)::date <> _month_cursor LOOP
            _date := _date - INTERVAL '7 days';
          END LOOP;
        ELSE
          _effective_day := COALESCE(_item.phase_day_start, 1);
          _date := _month_cursor + (LEAST(_effective_day, _month_last_day) - 1);
        END IF;

        IF _date >= _cycle_start AND _date <= _cycle_end THEN
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
        END IF;

        _month_cursor := CASE _item.frequency
          WHEN 'trimestral' THEN _month_cursor + INTERVAL '3 months'
          ELSE _month_cursor + INTERVAL '1 month'
        END;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', _inserted, 'skipped', _skipped);
END;
$$;

UPDATE public.product_phases
   SET is_recurring = false,
       recurrence_anchor_day = NULL,
       recurrence_lead_days = NULL,
       recurrence_week_of_month = NULL
 WHERE is_monthly_cycle = true
   AND product_id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0'::uuid;

WITH monthly_template_phases AS (
  SELECT id
    FROM public.product_phases
   WHERE product_id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0'::uuid
     AND is_monthly_cycle = true
), old_project_phases AS (
  SELECT pp.id
    FROM public.project_phases pp
    JOIN public.projects p ON p.id = pp.project_id
   WHERE p.product_id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0'::uuid
     AND pp.cycle_month_index IS NULL
     AND pp.source_phase_id IN (SELECT id FROM monthly_template_phases)
)
DELETE FROM public.project_deliverables pd
 USING old_project_phases oldp
 WHERE pd.phase_id = oldp.id;

WITH monthly_template_phases AS (
  SELECT id
    FROM public.product_phases
   WHERE product_id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0'::uuid
     AND is_monthly_cycle = true
)
DELETE FROM public.project_phases pp
 USING public.projects p
 WHERE p.id = pp.project_id
   AND p.product_id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0'::uuid
   AND pp.cycle_month_index IS NULL
   AND pp.source_phase_id IN (SELECT id FROM monthly_template_phases);

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT id
      FROM public.projects
     WHERE product_id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0'::uuid
       AND status NOT IN ('concluido','cancelado','arquivado')
  LOOP
    PERFORM public.generate_cycle_occurrences(rec.id);
  END LOOP;
END;
$$;