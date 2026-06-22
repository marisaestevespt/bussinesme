CREATE OR REPLACE FUNCTION public.generate_cycle_phases(_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _proj record;
  _tpl record;
  _del record;
  _month int;
  _base_date date;
  _month_start date;
  _last_day int;
  _day_start int;
  _day_end int;
  _phase_start date;
  _phase_end date;
  _new_phase_id uuid;
  _phases_added int := 0;
  _del_added int := 0;
BEGIN
  SELECT id, product_id, cycle_duration_months, cycle_start_date, start_date
    INTO _proj
    FROM public.projects WHERE id = _project_id;

  IF _proj.product_id IS NULL
     OR _proj.cycle_duration_months IS NULL
     OR _proj.cycle_duration_months <= 0 THEN
    RETURN jsonb_build_object('phases_added', 0, 'deliverables_added', 0);
  END IF;

  _base_date := COALESCE(_proj.cycle_start_date, _proj.start_date, CURRENT_DATE);

  FOR _tpl IN
    SELECT id, name, description, sort_order, linked_sop_id,
           cycle_day_start, cycle_day_end, duration_unit
      FROM public.product_phases
     WHERE product_id = _proj.product_id
       AND is_monthly_cycle = true
     ORDER BY sort_order
  LOOP
    FOR _month IN 1.._proj.cycle_duration_months LOOP
      _month_start := (date_trunc('month', _base_date) + ((_month - 1) || ' months')::interval)::date;
      _last_day := EXTRACT(DAY FROM (_month_start + INTERVAL '1 month - 1 day'))::int;
      -- Fallback: se nao houver cycle_day_start/end definidos, usa dia 1 ate ultimo dia do mes
      _day_start := COALESCE(_tpl.cycle_day_start, 1);
      _day_end   := COALESCE(_tpl.cycle_day_end, _last_day);
      _phase_start := _month_start + (LEAST(_day_start, _last_day) - 1);
      _phase_end   := _month_start + (LEAST(_day_end,   _last_day) - 1);

      BEGIN
        INSERT INTO public.project_phases (
          project_id, source_phase_id, cycle_month_index,
          name, description, sort_order, status, linked_sop_id,
          planned_start, planned_end,
          is_onboarding, is_recurring, is_offboarding,
          duration_unit, offset_trigger
        ) VALUES (
          _project_id, _tpl.id, _month,
          _tpl.name, _tpl.description,
          _tpl.sort_order * 1000 + _month,
          'pendente', _tpl.linked_sop_id,
          _phase_start, _phase_end,
          false, false, false,
          COALESCE(_tpl.duration_unit, 'dias_corridos'),
          'inicio_projeto'
        )
        RETURNING id INTO _new_phase_id;

        _phases_added := _phases_added + 1;

        FOR _del IN
          SELECT *
            FROM public.product_deliverable_templates
           WHERE phase_id = _tpl.id
        LOOP
          INSERT INTO public.project_deliverables (
            project_id, phase_id, cycle_month_index, source_template_id,
            name, description, sort_order, status,
            portal_visible, responsible_type, responsible_role, is_meeting,
            deliverable_type, linked_sop_id, estimated_minutes,
            meeting_title_template, link_url, document_url, document_file_path,
            planned_start, planned_end, deadline, scheduled_date
          ) VALUES (
            _project_id, _new_phase_id, _month, _del.id,
            _del.name, _del.description, COALESCE(_del.sort_order, 0), 'pending',
            COALESCE(_del.portal_visible, true), _del.responsible_type, _del.responsible_role,
            COALESCE(_del.is_meeting, false), _del.deliverable_type, _del.linked_sop_id,
            _del.estimated_minutes, _del.meeting_title_template,
            _del.link_url, _del.document_url, _del.document_file_path,
            _phase_start, _phase_end, _phase_end, _phase_end
          );
          _del_added := _del_added + 1;
        END LOOP;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'phases_added', _phases_added,
    'deliverables_added', _del_added
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_cycle_phases(uuid) TO authenticated, service_role;