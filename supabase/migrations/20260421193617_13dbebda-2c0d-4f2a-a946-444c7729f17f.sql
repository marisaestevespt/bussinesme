-- Smoke test: rename product, verify cascade, restore name, cleanup test rows.

-- 1) Rename product
UPDATE public.products
   SET name = 'Assistente Virtual TESTE_RENAME'
 WHERE id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0';

-- 2) Verify cascade worked (will appear in result set as a NOTICE-style check via DO block)
DO $$
DECLARE
  _bad int;
BEGIN
  SELECT COUNT(*) INTO _bad FROM (
    SELECT product       AS n FROM public.commercial_sales            WHERE sale_id = 'SMOKE-001'
    UNION ALL SELECT product       FROM public.commercial_sales_actions    WHERE notes = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product       FROM public.commercial_library_entries  WHERE title = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product_name  FROM public.commercial_product_goals    WHERE year = 2099
    UNION ALL SELECT product       FROM public.crm_pipelines               WHERE name  = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product_name  FROM public.events                      WHERE title = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product_name  FROM public.marketing_automations       WHERE name  = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product_name  FROM public.marketing_funnels           WHERE name  = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product_name  FROM public.traffic_creatives           WHERE name  = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product_name  FROM public.content_items               WHERE title = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product_name  FROM public.meetings                    WHERE title = 'SMOKE_TEST_2026_04_21'
    UNION ALL SELECT product_name  FROM public.sops                        WHERE name  = 'SMOKE_TEST_2026_04_21' AND status = 'para_criar'
  ) sub
  WHERE n <> 'Assistente Virtual TESTE_RENAME';

  IF _bad > 0 THEN
    RAISE EXCEPTION 'Cascade FAILED — % rows still have stale product name', _bad;
  END IF;
  RAISE NOTICE 'Cascade OK on all 12 tables';
END $$;

-- 3) Restore original name (cascade fires again)
UPDATE public.products
   SET name = 'Assistente Virtual'
 WHERE id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0';

-- 4) Cleanup smoke test rows
DELETE FROM public.commercial_sales            WHERE sale_id = 'SMOKE-001';
DELETE FROM public.commercial_sales_actions    WHERE notes = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.commercial_library_entries  WHERE title = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.commercial_product_goals    WHERE year = 2099;
DELETE FROM public.crm_pipelines               WHERE name  = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.events                      WHERE title = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.marketing_automations       WHERE name  = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.marketing_funnels           WHERE name  = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.traffic_creatives           WHERE name  = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.content_items               WHERE title = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.meetings                    WHERE title = 'SMOKE_TEST_2026_04_21';
DELETE FROM public.sops                        WHERE name  = 'SMOKE_TEST_2026_04_21' AND status = 'para_criar';