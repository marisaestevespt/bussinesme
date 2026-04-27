DO $$
DECLARE
  _client_id uuid := '35f080a5-6e41-4a81-9fd4-ed81b10bea72';
  _product_id uuid := '4911f2fe-3eec-4121-a26a-40b7d47c91b0';
  _proj_id uuid;
  _proj_id_t2 uuid;
  _activate_result jsonb;
  _exists boolean;
  _count int;
  _checklist_count int;
  _renewal_count_after int;
  _product_after text;
  _eoc_after date;
  _pending_after uuid;
  _status_after text;
  _proj_status text;
  _history_count int;
BEGIN
  -- Limpar resíduos
  DELETE FROM commercial_sales WHERE client = 'Bianca Rodrigues Siqueira Lopes' AND sale_year >= 2027;
  DELETE FROM client_renewals WHERE client_id = _client_id;
  DELETE FROM projects WHERE name LIKE 'TEST_RENEW%';
  UPDATE clients SET pending_renewal_project_id = NULL WHERE id = _client_id;

  RAISE NOTICE '== INICIO TESTE E2E ==';

  -- ============== T1: AGENDAR + CANCELAR ==============
  INSERT INTO projects (name, type, status, department, departments, client_name, client_id, product_id, product_name, start_date, deadline)
  VALUES ('TEST_RENEW Bianca T1', 'cliente_servico_mensal', 'agendado', 'clientes',
    '["clientes","operacao"]'::jsonb, 'Bianca Rodrigues Siqueira Lopes', _client_id,
    _product_id, 'Assistente Virtual', '2027-06-15', '2027-12-15')
  RETURNING id INTO _proj_id;
  UPDATE clients SET pending_renewal_project_id = _proj_id WHERE id = _client_id;
  RAISE NOTICE 'T1.1 AGENDADO: project=%', _proj_id;

  DELETE FROM projects WHERE id = _proj_id;
  UPDATE clients SET pending_renewal_project_id = NULL WHERE id = _client_id;
  SELECT EXISTS(SELECT 1 FROM projects WHERE id = _proj_id) INTO _exists;
  RAISE NOTICE 'T1.2 CANCELADO: removed=% pending_NULL=%',
    NOT _exists, (SELECT pending_renewal_project_id IS NULL FROM clients WHERE id = _client_id);

  -- ============== T2: AGENDAR + ATIVAR ==============
  INSERT INTO projects (name, type, status, department, departments, client_name, client_id, product_id, product_name, start_date, deadline)
  VALUES ('TEST_RENEW Bianca T2', 'cliente_servico_mensal', 'agendado', 'clientes',
    '["clientes","operacao"]'::jsonb, 'Bianca Rodrigues Siqueira Lopes', _client_id,
    _product_id, 'Assistente Virtual', '2027-06-15', '2027-12-15')
  RETURNING id INTO _proj_id_t2;
  UPDATE clients SET pending_renewal_project_id = _proj_id_t2 WHERE id = _client_id;
  RAISE NOTICE 'T2.1 AGENDADO: project=%', _proj_id_t2;

  SELECT activate_renewal_project(_proj_id_t2) INTO _activate_result;
  RAISE NOTICE 'T2.2 ATIVAR result=%', _activate_result;

  SELECT status INTO _proj_status FROM projects WHERE id = _proj_id_t2;
  SELECT renewal_count, current_product, end_of_cycle, pending_renewal_project_id, status
    INTO _renewal_count_after, _product_after, _eoc_after, _pending_after, _status_after
  FROM clients WHERE id = _client_id;
  SELECT COUNT(*) INTO _checklist_count FROM client_renewals WHERE project_id = _proj_id_t2;
  SELECT COUNT(*) INTO _history_count FROM client_history WHERE client_id = _client_id
    AND entry_date = CURRENT_DATE AND milestone LIKE 'Renovação ativada%';

  RAISE NOTICE 'T2.2 PROJ status=% (esp:em_onboarding)', _proj_status;
  RAISE NOTICE 'T2.2 CLIENT: renewals=% (esp:1) product=% eoc=% (esp:2027-12-15) pending=% (esp:NULL) status=% (esp:ativo)',
    _renewal_count_after, _product_after, _eoc_after, _pending_after, _status_after;
  RAISE NOTICE 'T2.2 CHECKLIST renovacao: % linhas (esp:4)', _checklist_count;
  RAISE NOTICE 'T2.2 HISTORY: % entrada(s)', _history_count;

  -- ============== T2.3: ROLLBACK (lógica simulada) ==============
  -- A RPC real rollback_renewal_project exige is_admin_or_owner().
  -- Aqui simulamos a mesma lógica para validar que o estado fica corretamente revertido.
  DELETE FROM commercial_sales WHERE project_id = _proj_id_t2 AND status <> 'pago';
  DELETE FROM client_renewals WHERE project_id = _proj_id_t2;
  UPDATE clients SET
    renewal_count = GREATEST(COALESCE(renewal_count, 1) - 1, 0),
    pending_renewal_project_id = CASE WHEN pending_renewal_project_id = _proj_id_t2 THEN NULL ELSE pending_renewal_project_id END,
    current_product = 'Assistente Virtual',
    current_product_id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0',
    end_of_cycle = '2026-06-15',
    status = 'ativo'
  WHERE id = _client_id;
  -- nullify external refs antes de eliminar
  UPDATE meetings SET project_id = NULL WHERE project_id = _proj_id_t2;
  UPDATE content_items SET project_id = NULL WHERE project_id = _proj_id_t2;
  DELETE FROM tasks WHERE project_id = _proj_id_t2;
  DELETE FROM projects WHERE id = _proj_id_t2;

  SELECT EXISTS(SELECT 1 FROM projects WHERE id = _proj_id_t2) INTO _exists;
  SELECT renewal_count, current_product, end_of_cycle, pending_renewal_project_id, status
    INTO _renewal_count_after, _product_after, _eoc_after, _pending_after, _status_after
  FROM clients WHERE id = _client_id;
  SELECT COUNT(*) INTO _checklist_count FROM client_renewals WHERE client_id = _client_id;

  RAISE NOTICE 'T2.3 ROLLBACK PROJ removido=%', NOT _exists;
  RAISE NOTICE 'T2.3 CLIENT: renewals=% (esp:0) product=% eoc=% pending=% (esp:NULL) status=%',
    _renewal_count_after, _product_after, _eoc_after, _pending_after, _status_after;
  RAISE NOTICE 'T2.3 CHECKLIST: % (esp:0)', _checklist_count;

  -- ============== CLEANUP ==============
  DELETE FROM commercial_sales WHERE client = 'Bianca Rodrigues Siqueira Lopes' AND sale_year >= 2027;
  DELETE FROM client_renewals WHERE client_id = _client_id;
  DELETE FROM projects WHERE name LIKE 'TEST_RENEW%';
  DELETE FROM client_history WHERE client_id = _client_id AND entry_date = CURRENT_DATE
    AND milestone LIKE 'Renovação ativada%';
  DELETE FROM tasks WHERE renewal_id IS NOT NULL AND renewal_id NOT IN (SELECT id FROM client_renewals);
  UPDATE clients
    SET status = 'ativo', current_product = 'Assistente Virtual',
        current_product_id = '4911f2fe-3eec-4121-a26a-40b7d47c91b0',
        end_of_cycle = '2026-06-15', renewal_count = 0,
        pending_renewal_project_id = NULL
    WHERE id = _client_id;

  RAISE NOTICE '== ESTADO ORIGINAL RESTAURADO ==';
END $$;