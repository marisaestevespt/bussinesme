-- ============================================================
-- TESTE AUTOMÁTICO: Cascade de rename de produto
-- Valida que mudar o nome de um produto propaga para todas as
-- 17 tabelas dependentes via trigger sync_product_name_cascade.
-- ============================================================
\set ON_ERROR_STOP on
\timing off

-- Tabela temporária para coletar resultados
CREATE TEMP TABLE _test_results (
  table_name text,
  expected text,
  actual text,
  passed boolean
) ON COMMIT DROP;

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
  _portal_id uuid;

  _ts text := extract(epoch from now())::bigint::text;
  _original_name text;
  _new_name text;
BEGIN
  _original_name := '__TEST_PROD_' || _ts;
  _new_name := '__RENAMED_PROD_' || _ts;

  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '  TEST: Product rename cascade (%)', _ts;
  RAISE NOTICE '════════════════════════════════════════';

  INSERT INTO products (name, status) VALUES (_original_name, 'vendas_ativas') RETURNING id INTO _product_id;

  INSERT INTO clients (full_name, current_product_id, status) VALUES ('__test_client_'||_ts, _product_id, 'ativo') RETURNING id INTO _client_id;
  INSERT INTO crm_leads (name, potential_product_id) VALUES ('__test_lead', _product_id) RETURNING id INTO _lead_id;
  INSERT INTO commercial_sales (sale_id, client, product_id, invoice_total, base_value, sale_year, sale_month, status) VALUES ('__TEST_'||_ts, '__test', _product_id, 100, 100, 2026, 1, 'pago') RETURNING id INTO _sale_id;
  INSERT INTO commercial_sales_actions (product_id, action_name) VALUES (_product_id, '__test_action') RETURNING id INTO _action_id;
  INSERT INTO commercial_library_entries (product_id, title, entry_type) VALUES (_product_id, '__test_lib', 'documento') RETURNING id INTO _library_id;
  INSERT INTO commercial_product_goals (product_id, year, product_name) VALUES (_product_id, 2026, _original_name) RETURNING id INTO _goal_id;
  INSERT INTO crm_pipelines (product_id, name) VALUES (_product_id, '__test_pipeline') RETURNING id INTO _pipeline_id;
  INSERT INTO events (product_id, title, start_date) VALUES (_product_id, '__test_event', now()) RETURNING id INTO _event_id;
  INSERT INTO marketing_automations (product_id, name) VALUES (_product_id, '__test_auto') RETURNING id INTO _automation_id;
  INSERT INTO marketing_funnels (product_id, name) VALUES (_product_id, '__test_funnel') RETURNING id INTO _funnel_id;
  INSERT INTO traffic_creatives (product_id, name) VALUES (_product_id, '__test_creative') RETURNING id INTO _creative_id;
  INSERT INTO content_items (product_id, title, content_type) VALUES (_product_id, '__test_content', 'post') RETURNING id INTO _content_id;
  INSERT INTO meetings (product_id, title, date_time, status) VALUES (_product_id, '__test_meeting', now(), 'por_confirmar') RETURNING id INTO _meeting_id;
  INSERT INTO projects (name, product_id, status) VALUES ('__test_project', _product_id, 'em_curso') RETURNING id INTO _project_id;
  INSERT INTO sops (name, product_id, department, status) VALUES ('__test_sop', _product_id, 'produtos', 'ativo') RETURNING id INTO _sop_id;
  INSERT INTO capacity_scenarios (name) VALUES ('__test_scenario_'||_ts) RETURNING id INTO _scenario_id;
  INSERT INTO capacity_scenario_products (scenario_id, product_id, product_name) VALUES (_scenario_id, _product_id, _original_name) RETURNING id INTO _capacity_id;
  INSERT INTO client_portals (client_id, slug, portal_type) VALUES (_client_id, '__test_portal_'||_ts, 'projeto_unico') RETURNING id INTO _portal_id;
  INSERT INTO portal_project_history (portal_id, product_id, project_name) VALUES (_portal_id, _product_id, '__test_hist') RETURNING id INTO _portal_hist_id;

  RAISE NOTICE 'Inserted 17 dependent rows. Renaming product...';

  -- Trigger cascade
  UPDATE products SET name = _new_name WHERE id = _product_id;

  -- Coletar resultados
  INSERT INTO _test_results
  SELECT 'clients.current_product', _new_name, current_product, current_product = _new_name FROM clients WHERE id = _client_id UNION ALL
  SELECT 'crm_leads.potential_product', _new_name, potential_product, potential_product = _new_name FROM crm_leads WHERE id = _lead_id UNION ALL
  SELECT 'commercial_sales.product', _new_name, product, product = _new_name FROM commercial_sales WHERE id = _sale_id UNION ALL
  SELECT 'commercial_sales_actions.product', _new_name, product, product = _new_name FROM commercial_sales_actions WHERE id = _action_id UNION ALL
  SELECT 'commercial_library_entries.product', _new_name, product, product = _new_name FROM commercial_library_entries WHERE id = _library_id UNION ALL
  SELECT 'commercial_product_goals.product_name', _new_name, product_name, product_name = _new_name FROM commercial_product_goals WHERE id = _goal_id UNION ALL
  SELECT 'crm_pipelines.product', _new_name, product, product = _new_name FROM crm_pipelines WHERE id = _pipeline_id UNION ALL
  SELECT 'events.product_name', _new_name, product_name, product_name = _new_name FROM events WHERE id = _event_id UNION ALL
  SELECT 'marketing_automations.product_name', _new_name, product_name, product_name = _new_name FROM marketing_automations WHERE id = _automation_id UNION ALL
  SELECT 'marketing_funnels.product_name', _new_name, product_name, product_name = _new_name FROM marketing_funnels WHERE id = _funnel_id UNION ALL
  SELECT 'traffic_creatives.product_name', _new_name, product_name, product_name = _new_name FROM traffic_creatives WHERE id = _creative_id UNION ALL
  SELECT 'content_items.product_name', _new_name, product_name, product_name = _new_name FROM content_items WHERE id = _content_id UNION ALL
  SELECT 'meetings.product_name', _new_name, product_name, product_name = _new_name FROM meetings WHERE id = _meeting_id UNION ALL
  SELECT 'projects.product_name', _new_name, product_name, product_name = _new_name FROM projects WHERE id = _project_id UNION ALL
  SELECT 'sops.product_name', _new_name, product_name, product_name = _new_name FROM sops WHERE id = _sop_id UNION ALL
  SELECT 'capacity_scenario_products.product_name', _new_name, product_name, product_name = _new_name FROM capacity_scenario_products WHERE id = _capacity_id UNION ALL
  SELECT 'portal_project_history.product_name', _new_name, product_name, product_name = _new_name FROM portal_project_history WHERE id = _portal_hist_id;

  -- Cleanup
  DELETE FROM portal_project_history WHERE id = _portal_hist_id;
  DELETE FROM client_portals WHERE id = _portal_id;
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

  RAISE NOTICE 'Cleanup done.';
END $$;

-- Resultado individual
SELECT
  CASE WHEN passed THEN '✅ PASS' ELSE '❌ FAIL' END AS result,
  table_name,
  CASE WHEN passed THEN '' ELSE ('expected="'||expected||'" got="'||COALESCE(actual,'NULL')||'"') END AS detail
FROM _test_results
ORDER BY passed, table_name;

-- Sumário
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  CASE WHEN COUNT(*) FILTER (WHERE NOT passed) = 0
       THEN '✅ ALL TESTS PASSED'
       ELSE '❌ '||COUNT(*) FILTER (WHERE NOT passed)||' FAILURE(S)'
  END AS verdict
FROM _test_results;

-- Sair com erro se algum falhou
DO $$
DECLARE _failed int;
BEGIN
  SELECT COUNT(*) INTO _failed FROM _test_results WHERE NOT passed;
  IF _failed > 0 THEN
    RAISE EXCEPTION 'Test failed: % cascade(s) did not propagate', _failed;
  END IF;
END $$;
