CREATE OR REPLACE FUNCTION public.sync_project_with_template(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _product_id uuid;
  _project_start date;
  _project_client uuid;
  _project_dept text;
  _phases_added int := 0;
  _deliverables_added int := 0;
  _meetings_added int := 0;
  _occ_result jsonb := '{}'::jsonb;
  _cycle_phases_result jsonb := '{}'::jsonb;
  _phase record;
  _del record;
  _cursor_date date;
  _phase_start date;
  _phase_end date;
  _meeting_id uuid;
BEGIN
  SELECT product_id, start_date, client_id, department
    INTO _product_id, _project_start, _project_client, _project_dept
    FROM public.projects WHERE id = _project_id;
  IF _product_id IS NULL THEN
    RETURN jsonb_build_object('error', 'project has no product');
  END IF;

  UPDATE public.projects p
     SET cycle_duration_months = COALESCE(p.cycle_duration_months, pr.cycle_duration),
         cycle_start_date      = COALESCE(p.cycle_start_date, p.start_date),
         cycle_renewable       = COALESCE(NULLIF(p.cycle_renewable, false), pr.cycle_renewable, false)
    FROM public.products pr
   WHERE p.id = _project_id AND pr.id = p.product_id;

  -- Fases one-shot (exclui mini-fases mensais, tratadas em generate_cycle_phases)
  WITH inserted_phases AS (
    INSERT INTO public.project_phases (
      project_id, name, description, sort_order, status, source_phase_id, linked_sop_id,
      duration_days, duration_unit, offset_days, offset_trigger, is_onboarding,
      is_recurring, recurrence_period, is_offboarding
    )
    SELECT _project_id, pp.name, pp.description, pp.sort_order, 'pendente', pp.id, pp.linked_sop_id,
      pp.duration_days, pp.duration_unit, pp.offset_days, pp.offset_trigger,
      COALESCE(pp.is_onboarding, false), COALESCE(pp.is_recurring, false),
      pp.recurrence_frequency, COALESCE(pp.is_offboarding, false)
    FROM public.product_phases pp
    WHERE pp.product_id = _product_id
      AND COALESCE(pp.is_monthly_cycle, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM public.project_phases existing
        WHERE existing.project_id = _project_id
          AND existing.cycle_month_index IS NULL
          AND (existing.source_phase_id = pp.id OR existing.sort_order = pp.sort_order OR lower(existing.name) = lower(pp.name))
      )
    RETURNING 1
  ) SELECT COUNT(*) INTO _phases_added FROM inserted_phases;

  -- Entregáveis de fases one-shot (exclui as ligadas a mini-fases mensais)
  WITH inserted_deliverables AS (
    INSERT INTO public.project_deliverables (
      project_id, phase_id, name, description, sort_order, status,
      portal_visible, responsible_type, responsible_role, is_meeting,
      deliverable_type, source_template_id, link_url, document_url,
      estimated_minutes, meeting_title_template, document_file_path
    )
    SELECT _project_id, pp_proj.id, pdt.name, pdt.description, pdt.sort_order, 'pending',
      pdt.portal_visible, pdt.responsible_type, pdt.responsible_role, COALESCE(pdt.is_meeting,false),
      pdt.deliverable_type, pdt.id, pdt.link_url, pdt.document_url,
      pdt.estimated_minutes, pdt.meeting_title_template, pdt.document_file_path
    FROM public.product_deliverable_templates pdt
    LEFT JOIN public.product_phases pp ON pp.id = pdt.phase_id
    LEFT JOIN public.project_phases pp_proj
      ON pp_proj.project_id = _project_id
      AND pp.id IS NOT NULL
      AND pp_proj.cycle_month_index IS NULL
      AND (pp_proj.source_phase_id = pp.id OR pp_proj.sort_order = pp.sort_order)
    WHERE pdt.product_id = _product_id
      AND COALESCE(pp.is_monthly_cycle, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM public.project_deliverables pd
        WHERE pd.project_id = _project_id
          AND pd.cycle_month_index IS NULL
          AND (pd.source_template_id = pdt.id OR pd.name = pdt.name)
      )
    RETURNING 1
  ) SELECT COUNT(*) INTO _deliverables_added FROM inserted_deliverables;

  -- Calcular datas para as fases one-shot (mantém comportamento anterior)
  IF _project_start IS NOT NULL THEN
    _cursor_date := _project_start;
    FOR _phase IN
      SELECT id, sort_order, COALESCE(offset_days, 0) AS offset_days, COALESCE(duration_days, 7) AS duration_days, planned_start, planned_end
      FROM public.project_phases
      WHERE project_id = _project_id
        AND cycle_month_index IS NULL
      ORDER BY sort_order, created_at
    LOOP
      _phase_start := COALESCE(_phase.planned_start, _cursor_date + (_phase.offset_days || ' days')::interval);
      _phase_end := COALESCE(_phase.planned_end, _phase_start + ((_phase.duration_days - 1) || ' days')::interval);
      UPDATE public.project_phases
         SET planned_start = COALESCE(planned_start, _phase_start),
             planned_end   = COALESCE(planned_end,   _phase_end)
       WHERE id = _phase.id;
      _cursor_date := _phase_end + INTERVAL '1 day';

      UPDATE public.project_deliverables
         SET planned_start = COALESCE(planned_start, _phase_start),
             planned_end   = COALESCE(planned_end,   _phase_end),
             deadline      = COALESCE(deadline,      _phase_end),
             scheduled_date = COALESCE(scheduled_date, _phase_end)
       WHERE phase_id = _phase.id
         AND cycle_month_index IS NULL;
    END LOOP;

    FOR _del IN
      SELECT pd.id, pd.name, pd.meeting_title_template, pd.estimated_minutes, pd.scheduled_date, pd.deadline
      FROM public.project_deliverables pd
      WHERE pd.project_id = _project_id
        AND pd.is_meeting = true
        AND pd.meeting_id IS NULL
        AND COALESCE(pd.scheduled_date, pd.deadline) IS NOT NULL
    LOOP
      INSERT INTO public.meetings (
        title, date_time, duration_minutes, project_id, client_id, department, status, meeting_type
      ) VALUES (
        COALESCE(NULLIF(_del.meeting_title_template, ''), _del.name),
        (COALESCE(_del.scheduled_date, _del.deadline)::timestamp + TIME '10:00') AT TIME ZONE 'UTC',
        COALESCE(_del.estimated_minutes, 60),
        _project_id, _project_client, _project_dept,
        CASE WHEN COALESCE(_del.scheduled_date, _del.deadline) >= CURRENT_DATE
             THEN 'por_confirmar'::meeting_status
             ELSE 'por_organizar'::meeting_status END,
        'cliente'
      ) RETURNING id INTO _meeting_id;

      UPDATE public.project_deliverables SET meeting_id = _meeting_id WHERE id = _del.id;
      _meetings_added := _meetings_added + 1;
    END LOOP;
  END IF;

  -- Mini-fases mensais + ocorrências recorrentes (só para projetos com ciclo)
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND cycle_duration_months IS NOT NULL) THEN
    _cycle_phases_result := public.generate_cycle_phases(_project_id);
    _occ_result := public.generate_cycle_occurrences(_project_id);
  END IF;

  RETURN jsonb_build_object(
    'phases_added', _phases_added,
    'added', _deliverables_added,
    'meetings_added', _meetings_added,
    'cycle_phases', _cycle_phases_result,
    'occurrences', _occ_result
  );
END;
$function$;