CREATE OR REPLACE FUNCTION public.bootstrap_project_from_product(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _proj record;
  _prod record;
  _phase_count int := 0;
  _deliv_count int := 0;
  _occ_result jsonb := NULL;
  _phases_existing int;
  _delivs_existing int;
  _id_map jsonb := '{}'::jsonb;
  _new_phase_id uuid;
  _tpl record;
  _phase_tpl record;
BEGIN
  SELECT id, product_id, project_mode, cycle_duration_months, cycle_start_date, start_date
    INTO _proj
    FROM public.projects
   WHERE id = _project_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','project not found');
  END IF;

  IF _proj.product_id IS NULL THEN
    RETURN jsonb_build_object('error','project has no product');
  END IF;

  SELECT id, cycle_duration INTO _prod FROM public.products WHERE id = _proj.product_id;

  -- Backfill cycle_duration_months from product if missing
  IF _proj.cycle_duration_months IS NULL AND _prod.cycle_duration IS NOT NULL THEN
    UPDATE public.projects
       SET cycle_duration_months = _prod.cycle_duration
     WHERE id = _project_id;
    _proj.cycle_duration_months := _prod.cycle_duration;
  END IF;

  -- Backfill cycle_start_date for recurring projects
  IF _proj.project_mode = 'recorrente' AND _proj.cycle_start_date IS NULL THEN
    UPDATE public.projects
       SET cycle_start_date = COALESCE(_proj.start_date, CURRENT_DATE)
     WHERE id = _project_id;
    _proj.cycle_start_date := COALESCE(_proj.start_date, CURRENT_DATE);
  END IF;

  -- Clone phases (only if project has no phases yet)
  SELECT COUNT(*) INTO _phases_existing FROM public.project_phases WHERE project_id = _project_id;
  IF _phases_existing = 0 THEN
    FOR _phase_tpl IN
      SELECT * FROM public.product_phases
       WHERE product_id = _proj.product_id
       ORDER BY sort_order, created_at
    LOOP
      INSERT INTO public.project_phases (
        project_id, name, description, sort_order, status,
        linked_sop_id, source_phase_id,
        duration_days, duration_unit, offset_days, offset_trigger,
        is_onboarding, is_offboarding
      ) VALUES (
        _project_id, _phase_tpl.name, _phase_tpl.description, _phase_tpl.sort_order, 'pendente',
        _phase_tpl.linked_sop_id, _phase_tpl.id,
        _phase_tpl.duration_days, _phase_tpl.duration_unit, _phase_tpl.offset_days, _phase_tpl.offset_trigger,
        COALESCE(_phase_tpl.is_onboarding, false), COALESCE(_phase_tpl.is_offboarding, false)
      )
      RETURNING id INTO _new_phase_id;
      _id_map := _id_map || jsonb_build_object(_phase_tpl.id::text, _new_phase_id::text);
      _phase_count := _phase_count + 1;
    END LOOP;
  END IF;

  -- Clone deliverables (only if project has no deliverables yet)
  SELECT COUNT(*) INTO _delivs_existing FROM public.project_deliverables WHERE project_id = _project_id;
  IF _delivs_existing = 0 THEN
    FOR _tpl IN
      SELECT * FROM public.product_deliverable_templates
       WHERE product_id = _proj.product_id
       ORDER BY sort_order, created_at
    LOOP
      INSERT INTO public.project_deliverables (
        project_id, name, description, sort_order, status,
        phase_id, linked_sop_id, portal_visible,
        duration_days, duration_unit, offset_days, offset_trigger,
        source_template_id, responsible_type, responsible_role,
        is_meeting, deliverable_type, estimated_minutes,
        meeting_title_template, link_url, document_url, document_file_path,
        email_subject, email_body, message_body, is_recurring
      ) VALUES (
        _project_id, _tpl.name, _tpl.description, _tpl.sort_order, 'pendente',
        CASE WHEN _tpl.phase_id IS NOT NULL AND _id_map ? _tpl.phase_id::text
             THEN (_id_map->>_tpl.phase_id::text)::uuid
             ELSE NULL END,
        _tpl.linked_sop_id, COALESCE(_tpl.portal_visible, false),
        _tpl.duration_days, _tpl.duration_unit, _tpl.offset_days, _tpl.offset_trigger,
        _tpl.id, _tpl.responsible_type, _tpl.responsible_role,
        COALESCE(_tpl.is_meeting, false), _tpl.deliverable_type, _tpl.estimated_minutes,
        _tpl.meeting_title_template, _tpl.link_url, _tpl.document_url, _tpl.document_file_path,
        _tpl.email_subject, _tpl.email_body, _tpl.message_body, COALESCE(_tpl.is_recurring, false)
      );
      _deliv_count := _deliv_count + 1;
    END LOOP;
  END IF;

  -- For recurring projects, generate cycle occurrences (idempotent - skips dups via unique constraint)
  IF _proj.project_mode = 'recorrente' AND _proj.cycle_duration_months IS NOT NULL AND _proj.cycle_duration_months > 0 THEN
    BEGIN
      _occ_result := public.generate_cycle_occurrences(_project_id);
    EXCEPTION WHEN OTHERS THEN
      _occ_result := jsonb_build_object('error', SQLERRM);
    END;
  END IF;

  RETURN jsonb_build_object(
    'phases_created', _phase_count,
    'deliverables_created', _deliv_count,
    'occurrences', _occ_result,
    'cycle_duration_months', _proj.cycle_duration_months
  );
END;
$function$;

-- Allow authenticated users to call (RLS on underlying tables still applies)
GRANT EXECUTE ON FUNCTION public.bootstrap_project_from_product(uuid) TO authenticated;