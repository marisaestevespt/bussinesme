
-- 1) Campos novos em products e projects
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cycle_renewable boolean NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cycle_duration_months integer,
  ADD COLUMN IF NOT EXISTS cycle_start_date date,
  ADD COLUMN IF NOT EXISTS cycle_renewable boolean NOT NULL DEFAULT false;

-- 2) Template no produto
CREATE TABLE IF NOT EXISTS public.product_recurring_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  item_type text NOT NULL CHECK (item_type IN ('reuniao','tarefa','entrega')),
  frequency text NOT NULL CHECK (frequency IN ('semanal','quinzenal','mensal','trimestral')),
  day_of_week smallint CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month smallint CHECK (day_of_month BETWEEN 1 AND 31),
  week_of_month smallint CHECK (week_of_month BETWEEN 1 AND 4),
  scheduled_time time,
  duration_minutes integer,
  visible_in_portal boolean NOT NULL DEFAULT true,
  linked_sop_id uuid,
  default_responsible_role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_recurring_items_product ON public.product_recurring_items(product_id);

ALTER TABLE public.product_recurring_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product recurring items"
  ON public.product_recurring_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage product recurring items"
  ON public.product_recurring_items FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 3) Instâncias por projeto
CREATE TABLE IF NOT EXISTS public.project_recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_recurring_item_id uuid REFERENCES public.product_recurring_items(id) ON DELETE SET NULL,
  item_type text NOT NULL CHECK (item_type IN ('reuniao','tarefa','entrega')),
  name text NOT NULL,
  description text,
  scheduled_date date NOT NULL,
  scheduled_time time,
  duration_minutes integer,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','cancelada','reagendada')),
  visible_in_portal boolean NOT NULL DEFAULT true,
  cycle_index integer,
  sort_order integer NOT NULL DEFAULT 0,
  linked_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  linked_task_id uuid,
  linked_deliverable_id uuid REFERENCES public.project_deliverables(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_occurrences_project ON public.project_recurring_occurrences(project_id);
CREATE INDEX IF NOT EXISTS idx_pro_occurrences_date ON public.project_recurring_occurrences(project_id, scheduled_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_occurrences_source_date
  ON public.project_recurring_occurrences(project_id, source_recurring_item_id, scheduled_date)
  WHERE source_recurring_item_id IS NOT NULL;

ALTER TABLE public.project_recurring_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project recurring occurrences"
  ON public.project_recurring_occurrences FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage project recurring occurrences"
  ON public.project_recurring_occurrences FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 4) Trigger updated_at
CREATE TRIGGER trg_product_recurring_items_updated
  BEFORE UPDATE ON public.product_recurring_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_project_recurring_occurrences_updated
  BEFORE UPDATE ON public.project_recurring_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Função geradora — idempotente
CREATE OR REPLACE FUNCTION public.generate_cycle_occurrences(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proj record;
  _item record;
  _cycle_end date;
  _date date;
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
    SELECT * FROM public.product_recurring_items WHERE product_id = _proj.product_id ORDER BY sort_order
  LOOP
    _date := COALESCE(_proj.cycle_start_date, _proj.start_date, CURRENT_DATE);

    -- Para semanal/quinzenal: avançar até ao primeiro dia da semana correto
    IF _item.frequency IN ('semanal','quinzenal') AND _item.day_of_week IS NOT NULL THEN
      WHILE EXTRACT(DOW FROM _date)::int <> _item.day_of_week LOOP
        _date := _date + INTERVAL '1 day';
      END LOOP;
    END IF;

    -- Para mensal/trimestral com day_of_month: posicionar no dia certo
    IF _item.frequency IN ('mensal','trimestral') AND _item.day_of_month IS NOT NULL THEN
      _date := date_trunc('month', _date)::date
              + (LEAST(_item.day_of_month, EXTRACT(DAY FROM (date_trunc('month', _date) + INTERVAL '1 month - 1 day'))::int) - 1);
      IF _date < COALESCE(_proj.cycle_start_date, _proj.start_date, CURRENT_DATE) THEN
        _date := _date + INTERVAL '1 month';
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

  RETURN jsonb_build_object('inserted', _inserted, 'skipped_existing', _skipped, 'cycle_end', _cycle_end);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_cycle_occurrences(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_cycle_occurrences(uuid) TO authenticated;

-- 6) Atualizar sync_project_with_template para também herdar ciclo + gerar ocorrências
CREATE OR REPLACE FUNCTION public.sync_project_with_template(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product_id uuid;
  _phases_added int := 0;
  _deliverables_added int := 0;
  _occ_result jsonb := '{}'::jsonb;
BEGIN
  SELECT product_id INTO _product_id FROM public.projects WHERE id = _project_id;
  IF _product_id IS NULL THEN
    RETURN jsonb_build_object('error', 'project has no product');
  END IF;

  -- Herdar ciclo do produto se ainda não definido no projeto
  UPDATE public.projects p
     SET cycle_duration_months = COALESCE(p.cycle_duration_months, pr.cycle_duration),
         cycle_start_date      = COALESCE(p.cycle_start_date, p.start_date),
         cycle_renewable       = COALESCE(NULLIF(p.cycle_renewable, false), pr.cycle_renewable, false)
    FROM public.products pr
   WHERE p.id = _project_id AND pr.id = p.product_id;

  WITH inserted_phases AS (
    INSERT INTO public.project_phases (
      project_id, name, description, sort_order, status, source_phase_id, linked_sop_id,
      duration_days, duration_unit, offset_days, offset_trigger, is_onboarding,
      is_recurring, recurrence_frequency, recurrence_anchor_day, recurrence_lead_days,
      recurrence_week_of_month, is_offboarding
    )
    SELECT _project_id, pp.name, pp.description, pp.sort_order, 'pendente', pp.id, pp.linked_sop_id,
      pp.duration_days, pp.duration_unit, pp.offset_days, pp.offset_trigger,
      COALESCE(pp.is_onboarding, false), COALESCE(pp.is_recurring, false),
      pp.recurrence_frequency, pp.recurrence_anchor_day, pp.recurrence_lead_days,
      pp.recurrence_week_of_month, COALESCE(pp.is_offboarding, false)
    FROM public.product_phases pp
    WHERE pp.product_id = _product_id
      AND NOT EXISTS (
        SELECT 1 FROM public.project_phases existing
        WHERE existing.project_id = _project_id
          AND (existing.source_phase_id = pp.id OR existing.sort_order = pp.sort_order OR lower(existing.name) = lower(pp.name))
      )
    RETURNING 1
  ) SELECT COUNT(*) INTO _phases_added FROM inserted_phases;

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
      AND (pp_proj.source_phase_id = pp.id OR pp_proj.sort_order = pp.sort_order)
    WHERE pdt.product_id = _product_id
      AND NOT EXISTS (
        SELECT 1 FROM public.project_deliverables pd
        WHERE pd.project_id = _project_id
          AND (pd.source_template_id = pdt.id OR pd.name = pdt.name)
      )
    RETURNING 1
  ) SELECT COUNT(*) INTO _deliverables_added FROM inserted_deliverables;

  -- Gerar ocorrências do ciclo (se aplicável)
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = _project_id AND cycle_duration_months IS NOT NULL) THEN
    _occ_result := public.generate_cycle_occurrences(_project_id);
  END IF;

  RETURN jsonb_build_object(
    'phases_added', _phases_added,
    'added', _deliverables_added,
    'occurrences', _occ_result
  );
END;
$$;
