
-- Atomic activation of a scheduled renewal project.
-- Idempotent: safe to retry. Used by both the cron and (eventually) manual flow.
CREATE OR REPLACE FUNCTION public.activate_renewal_project(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _proj record;
  _client record;
  _next_cycle integer;
  _portal_id uuid;
  _portal_type portal_type;
  _product record;
  _today date := CURRENT_DATE;
  _other record;
BEGIN
  -- Lock the project row to serialize concurrent activations
  SELECT id, name, client_id, product_id, product_name, start_date, deadline, status
    INTO _proj
  FROM public.projects
  WHERE id = _project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('activated', false, 'reason', 'project_not_found');
  END IF;

  -- Idempotency guard: if already activated, return early
  IF _proj.status <> 'agendado' THEN
    RETURN jsonb_build_object('activated', false, 'reason', 'not_scheduled', 'current_status', _proj.status);
  END IF;

  IF _proj.client_id IS NULL THEN
    RETURN jsonb_build_object('activated', false, 'reason', 'no_client');
  END IF;

  -- Lock the client row too
  SELECT id, full_name, COALESCE(renewal_count, 0) AS renewal_count, pending_renewal_project_id
    INTO _client
  FROM public.clients
  WHERE id = _proj.client_id
  FOR UPDATE;

  _next_cycle := _client.renewal_count + 1;

  -- Resolve product (for portal type)
  IF _proj.product_id IS NOT NULL THEN
    SELECT id, name, product_type, cycle_duration INTO _product
    FROM public.products WHERE id = _proj.product_id;
  END IF;

  -- 1) Conclude other active (non-archive/cancel/concluido/agendado) projects + portal snapshot
  SELECT id INTO _portal_id FROM public.client_portals
    WHERE client_id = _proj.client_id LIMIT 1;

  FOR _other IN
    SELECT id, name, product_name, start_date, deadline, notes
    FROM public.projects
    WHERE client_id = _proj.client_id
      AND id <> _proj.id
      AND status NOT IN ('concluido','cancelado','arquivo','agendado')
  LOOP
    UPDATE public.projects SET status = 'concluido' WHERE id = _other.id;

    IF _portal_id IS NOT NULL THEN
      INSERT INTO public.portal_project_history (
        portal_id, project_id, project_name, product_name,
        start_date, end_date, status, timeline_phases, monthly_summaries, notes
      )
      SELECT
        _portal_id, _other.id, _other.name, _other.product_name,
        _other.start_date, _today::text, 'concluido',
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object('title', name, 'status', status, 'sort_order', sort_order) ORDER BY sort_order)
          FROM public.project_phases WHERE project_id = _other.id
        ), '[]'::jsonb),
        COALESCE((
          SELECT jsonb_agg(to_jsonb(s) ORDER BY s.year DESC, s.month DESC)
          FROM public.portal_monthly_summaries s WHERE s.portal_id = _portal_id
        ), '[]'::jsonb),
        _other.notes
      WHERE NOT EXISTS (
        SELECT 1 FROM public.portal_project_history
        WHERE portal_id = _portal_id AND project_id = _other.id
      );

      DELETE FROM public.portal_monthly_summaries WHERE portal_id = _portal_id;
    END IF;
  END LOOP;

  -- 2) Activate the scheduled project
  UPDATE public.projects SET status = 'em_onboarding' WHERE id = _proj.id;

  -- 3) Update client (only bump renewal_count if not already at _next_cycle to be safe)
  UPDATE public.clients SET
    current_product = _proj.product_name,
    current_product_id = _proj.product_id,
    start_date = _proj.start_date,
    end_of_cycle = _proj.deadline,
    status = 'ativo',
    renewal_count = _next_cycle,
    pending_renewal_project_id = NULL
  WHERE id = _proj.client_id;

  -- 4) Renewal checklist (only if missing for this cycle — uniq index also enforces it)
  IF _proj.product_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.client_renewals
       WHERE client_id = _proj.client_id AND cycle_number = _next_cycle
     )
  THEN
    INSERT INTO public.client_renewals (
      client_id, cycle_number, activity, phase, responsible,
      rule_days, rule_unit, rule_trigger, due_date, sort_order, completed
    )
    SELECT
      _proj.client_id,
      _next_cycle,
      t.name,
      t.notes,
      t.responsible_type,
      t.rule_days,
      t.rule_unit,
      t.rule_trigger,
      CASE
        WHEN t.rule_days IS NOT NULL AND _proj.deadline IS NOT NULL THEN
          (_proj.deadline::date
            + ((CASE WHEN t.rule_unit = 'semanas' THEN t.rule_days * 7 ELSE t.rule_days END)
               * (CASE WHEN t.rule_trigger = 'apos_inicio_ciclo' THEN 1 ELSE -1 END)) * INTERVAL '1 day'
          )::date
        ELSE NULL
      END,
      COALESCE(t.sort_order, 0),
      false
    FROM public.product_renewal_templates t
    WHERE t.product_id = _proj.product_id
    ORDER BY t.sort_order;
  END IF;

  -- 5) Reactivate portal + copy diagnostic questions (if missing)
  IF _product.product_type IS NOT NULL THEN
    IF _product.product_type IN ('projeto_1_1','servico_pontual','consultoria_individual','consultoria_grupo','mentoria_individual','mentoria_grupo','workshop') THEN
      _portal_type := 'projeto_unico';
    ELSIF _product.product_type = 'servico_mensal' THEN
      _portal_type := 'servico_mensal';
    ELSE
      _portal_type := NULL;
    END IF;

    IF _portal_type IS NOT NULL THEN
      IF _portal_id IS NULL THEN
        INSERT INTO public.client_portals (client_id, portal_type, is_active)
        VALUES (_proj.client_id, _portal_type, true)
        RETURNING id INTO _portal_id;
      ELSE
        UPDATE public.client_portals
        SET is_active = true, portal_type = _portal_type
        WHERE id = _portal_id;
      END IF;

      IF _portal_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.portal_initial_questions WHERE portal_id = _portal_id)
      THEN
        INSERT INTO public.portal_initial_questions (
          portal_id, question, sort_order, question_group, answer_type, group_sort_order
        )
        SELECT _portal_id, dq.question, COALESCE(dq.sort_order, 0),
               dq.question_group, COALESCE(dq.answer_type, 'text'), COALESCE(dq.group_sort_order, 0)
        FROM public.product_diagnostic_questions dq
        WHERE dq.product_id = _product.id
        ORDER BY dq.group_sort_order, dq.sort_order;
      END IF;
    END IF;
  END IF;

  -- 6) History entry (skip if duplicate same-day)
  INSERT INTO public.client_history (client_id, entry_date, milestone, observations)
  SELECT _proj.client_id, _today,
         'Renovação ativada automaticamente: ' || COALESCE(_proj.product_name, '?'),
         'Projeto agendado entrou em onboarding (ciclo #' || _next_cycle || ').'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.client_history
    WHERE client_id = _proj.client_id
      AND entry_date = _today
      AND milestone = 'Renovação ativada automaticamente: ' || COALESCE(_proj.product_name, '?')
  );

  RETURN jsonb_build_object(
    'activated', true,
    'project_id', _proj.id,
    'client_id', _proj.client_id,
    'cycle', _next_cycle
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_renewal_project(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_renewal_project(uuid) TO service_role;
