-- ============================================================
-- TESTE AUTOMÁTICO: Cascade de rename de produto
-- Valida que mudar o nome de um produto propaga para todas as
-- 15 tabelas dependentes via trigger sync_product_name_cascade.
-- ============================================================
\set ON_ERROR_STOP on
\timing off

DO $$
DECLARE
  _product_id uuid;
  _client_id uuid;
  _lead_id uuid;
  _project_id uuid;
  _sop_id uuid;
  _meeting_id uuid;
  _content_id uuid;
  _sale_id uuid;
  _action_id uuid;
  _library_id uuid;
  _goal_id uuid;
  _pipeline_id uuid;
  _event_id uuid;
  _automation_id uuid;
  _funnel_id uuid;
  _creative_id uuid;
  _portal_hist_id uuid;
  _capacity_id uuid;
  _scenario_id uuid;

  _original_name text := '__TEST_PRODUCT_' || extract(epoch from now())::bigint;
  _new_name text := '__RENAMED_PRODUCT_' || extract(epoch from now())::bigint;

  _checks int := 0;
  _failures int := 0;
  _val text;

  PROCEDURE _assert(_label text, _expected text, _actual text)
  LANGUAGE plpgsql AS $body$
  BEGIN
    IF _actual IS DISTINCT FROM _expected THEN
      RAISE NOTICE '  ❌ FAIL: % — expected "%", got "%"', _label, _expected, _actual;
    ELSE
      RAISE NOTICE '  ✅ PASS: %', _label;
    END IF;
  END;
  $body$;
BEGIN
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '  TEST: Product rename cascade';
  RAISE NOTICE '════════════════════════════════════════';

  -- 1. Criar produto base
  INSERT INTO products (name, status) VALUES (_original_name, 'vendas_ativas')
  RETURNING id INTO _product_id;
  RAISE NOTICE 'Created product: % (id=%)', _original_name, _product_id;

  -- 2. Criar registos em todas as tabelas dependentes
  INSERT INTO clients (full_name, current_product_id, status)
    VALUES ('__test_client', _product_id, 'ativo') RETURNING id INTO _client_id;
  INSERT INTO crm_leads (name, potential_product_id, status)
    VALUES ('__test_lead', _product_id, 'novo') RETURNING id INTO _lead_id;
  INSERT INTO commercial_sales (client, product_id, invoice_total, base_value, sale_year, sale_month, status)
    VALUES ('__test_client', _product_id, 100, 100, 2026, 1, 'pago') RETURNING id INTO _sale_id;
  INSERT INTO commercial_sales_actions (product_id, action_name, action_date)
    VALUES (_product_id, '__test_action', CURRENT_DATE) RETURNING id INTO _action_id;
  INSERT INTO commercial_library_entries (product_id, title, entry_type)
    VALUES (_product_id, '__test_lib', 'documento') RETURNING id INTO _library_id;
  INSERT INTO commercial_product_goals (product_id, year)
    VALUES (_product_id, 2026) RETURNING id INTO _goal_id;
  INSERT INTO crm_pipelines (product_id, name)
    VALUES (_product_id, '__test_pipeline') RETURNING id INTO _pipeline_id;
  INSERT INTO events (product_id, title, event_date)
    VALUES (_product_id, '__test_event', CURRENT_DATE) RETURNING id INTO _event_id;
  INSERT INTO marketing_automations (product_id, name)
    VALUES (_product_id, '__test_auto') RETURNING id INTO _automation_id;
  INSERT INTO marketing_funnels (product_id, name)
    VALUES (_product_id, '__test_funnel') RETURNING id INTO _funnel_id;
  INSERT INTO traffic_creatives (product_id, name)
    VALUES (_product_id, '__test_creative') RETURNING id INTO _creative_id;
  INSERT INTO content_items (product_id, title, content_type)
    VALUES (_product_id, '__test_content', 'post') RETURNING id INTO _content_id;
  INSERT INTO meetings (product_id, title, date_time, status)
    VALUES (_product_id, '__test_meeting', now(), 'por_organizar') RETURNING id INTO _meeting_id;
  INSERT INTO projects (name, product_id, status)
    VALUES ('__test_project', _product_id, 'em_curso') RETURNING id INTO _project_id;
  INSERT INTO sops (name, product_id, department, status)
    VALUES ('__test_sop', _product_id, 'produtos', 'ativo') RETURNING id INTO _sop_id;

  -- capacity_scenario_products requires scenario
  INSERT INTO capacity_scenarios (name) VALUES ('__test_scenario') RETURNING id INTO _scenario_id;
  INSERT INTO capacity_scenario_products (scenario_id, product_id)
    VALUES (_scenario_id, _product_id) RETURNING id INTO _capacity_id;

  -- portal_project_history requires portal
  DECLARE _portal_id uuid;
  BEGIN
    INSERT INTO client_portals (client_id, slug) VALUES (_client_id, '__test_portal_' || extract(epoch from now())::bigint)
      RETURNING id INTO _portal_id;
    INSERT INTO portal_project_history (portal_id, product_id, project_name)
      VALUES (_portal_id, _product_id, '__test_hist') RETURNING id INTO _portal_hist_id;
  END;

  RAISE NOTICE 'All dependent rows inserted. Now renaming...';

  -- 3. Rename do produto → dispara cascade
  UPDATE products SET name = _new_name WHERE id = _product_id;

  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE 'Verifying cascade propagation:';
  RAISE NOTICE '────────────────────────────────────────';

  -- 4. Verificar que TODAS as tabelas receberam o novo nome
  SELECT current_product INTO _val FROM clients WHERE id = _client_id;
  CALL _assert('clients.current_product', _new_name, _val);

  SELECT potential_product INTO _val FROM crm_leads WHERE id = _lead_id;
  CALL _assert('crm_leads.potential_product', _new_name, _val);

  SELECT product INTO _val FROM commercial_sales WHERE id = _sale_id;
  CALL _assert('commercial_sales.product', _new_name, _val);

  SELECT product INTO _val FROM commercial_sales_actions WHERE id = _action_id;
  CALL _assert('commercial_sales_actions.product', _new_name, _val);

  SELECT product INTO _val FROM commercial_library_entries WHERE id = _library_id;
  CALL _assert('commercial_library_entries.product', _new_name, _val);

  SELECT product_name INTO _val FROM commercial_product_goals WHERE id = _goal_id;
  CALL _assert('commercial_product_goals.product_name', _new_name, _val);

  SELECT product INTO _val FROM crm_pipelines WHERE id = _pipeline_id;
  CALL _assert('crm_pipelines.product', _new_name, _val);

  SELECT product_name INTO _val FROM events WHERE id = _event_id;
  CALL _assert('events.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM marketing_automations WHERE id = _automation_id;
  CALL _assert('marketing_automations.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM marketing_funnels WHERE id = _funnel_id;
  CALL _assert('marketing_funnels.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM traffic_creatives WHERE id = _creative_id;
  CALL _assert('traffic_creatives.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM content_items WHERE id = _content_id;
  CALL _assert('content_items.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM meetings WHERE id = _meeting_id;
  CALL _assert('meetings.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM projects WHERE id = _project_id;
  CALL _assert('projects.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM sops WHERE id = _sop_id;
  CALL _assert('sops.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM capacity_scenario_products WHERE id = _capacity_id;
  CALL _assert('capacity_scenario_products.product_name', _new_name, _val);

  SELECT product_name INTO _val FROM portal_project_history WHERE id = _portal_hist_id;
  CALL _assert('portal_project_history.product_name', _new_name, _val);

  -- 5. Cleanup
  RAISE NOTICE '────────────────────────────────────────';
  RAISE NOTICE 'Cleaning up test data...';
  DELETE FROM portal_project_history WHERE id = _portal_hist_id;
  DELETE FROM client_portals WHERE client_id = _client_id;
  DELETE FROM capacity_scenario_products WHERE id = _capacity_id;
  DELETE FROM capacity_scenarios WHERE id = _scenario_id;
  DELETE FROM sops WHERE id = _sop_id;
  DELETE FROM projects WHERE id = _project_id;
  DELETE FROM meetings WHERE id = _meeting_id;
  DELETE FROM content_items WHERE id = _content_id;
  DELETE FROM traffic_creatives WHERE id = _creative_id;
  DELETE FROM marketing_funnels WHERE id = _funnel_id;
  DELETE FROM marketing_automations WHERE id = _automation_id;
  DELETE FROM events WHERE id = _event_id;
  DELETE FROM crm_pipelines WHERE id = _pipeline_id;
  DELETE FROM commercial_product_goals WHERE id = _goal_id;
  DELETE FROM commercial_library_entries WHERE id = _library_id;
  DELETE FROM commercial_sales_actions WHERE id = _action_id;
  DELETE FROM commercial_sales WHERE id = _sale_id;
  DELETE FROM crm_leads WHERE id = _lead_id;
  DELETE FROM clients WHERE id = _client_id;
  DELETE FROM products WHERE id = _product_id;

  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '  TEST COMPLETE';
  RAISE NOTICE '════════════════════════════════════════';
END $$;
