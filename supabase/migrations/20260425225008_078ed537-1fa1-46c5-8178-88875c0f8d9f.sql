-- Corrigir mapeamento de tipos
CREATE OR REPLACE FUNCTION public.sync_expense_to_member_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment_type text;
BEGIN
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type NOT IN ('contract', 'contractor', 'salary', 'member_payment') THEN
    RETURN NEW;
  END IF;

  SELECT CASE 
    WHEN tm.member_type = 'prestador_servicos' THEN 'prestacao'
    WHEN tm.member_type = 'colaborador_fixo' THEN 'contrato_trabalho'
    ELSE 'prestacao'
  END INTO _payment_type
  FROM public.team_members tm
  WHERE tm.id = NEW.member_id;

  INSERT INTO public.member_payments (
    member_id, month, year, payment_type,
    gross_value, net_value, status
  )
  VALUES (
    NEW.member_id,
    NEW.expense_month,
    NEW.expense_year,
    COALESCE(_payment_type, 'prestacao'),
    COALESCE(NEW.total_with_vat, NEW.base_value, 0),
    COALESCE(NEW.base_value, NEW.total_with_vat, 0),
    COALESCE(NEW.status, 'pendente')
  )
  ON CONFLICT (member_id, month, year, payment_type)
  DO UPDATE SET
    gross_value = EXCLUDED.gross_value,
    net_value = EXCLUDED.net_value,
    status = EXCLUDED.status,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Atualizar função de teste para usar member_type
CREATE OR REPLACE FUNCTION public.test_payment_sync_e2e()
RETURNS TABLE(test_name text, expected text, actual text, passed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _member_id uuid;
  _expense_id uuid;
  _payment_id uuid;
  _ts text := extract(epoch from clock_timestamp())::bigint::text;
  _tmp_status text;
  _tmp_net numeric;
  _tmp_gross numeric;
  _exists boolean;
BEGIN
  -- Setup: member fictício SEM profile (profile_id é nullable)
  INSERT INTO team_members (full_name, email, member_type, status)
  VALUES ('__test_member_'||_ts, 'test_'||_ts||'@test.com', 'prestador_servicos', 'ativo')
  RETURNING id INTO _member_id;

  -- TESTE 1: Criar despesa → pagamento criado automaticamente
  INSERT INTO financial_expenses (
    expense_name, location, category, base_value, total_with_vat,
    expense_month, expense_year, member_id, source_type, status
  ) VALUES (
    '__test_exp_'||_ts, 'lisboa', 'recursos_humanos', 100, 123,
    1, 2026, _member_id, 'contract', 'por_pagar'
  ) RETURNING id INTO _expense_id;

  SELECT EXISTS(SELECT 1 FROM member_payments WHERE member_id = _member_id AND month = 1 AND year = 2026) INTO _exists;
  RETURN QUERY SELECT 'T1: Despesa cria pagamento'::text, 'true'::text, _exists::text, _exists;

  SELECT id INTO _payment_id FROM member_payments WHERE member_id = _member_id AND month = 1 AND year = 2026 LIMIT 1;

  -- TESTE 2: Atualizar status despesa → propaga ao pagamento
  UPDATE financial_expenses SET status = 'pago' WHERE id = _expense_id;
  SELECT status INTO _tmp_status FROM member_payments WHERE id = _payment_id;
  RETURN QUERY SELECT 'T2: Status despesa→pagamento'::text, 'pago'::text, _tmp_status, _tmp_status = 'pago';

  -- TESTE 3: Atualizar valor despesa → propaga ao pagamento
  UPDATE financial_expenses SET base_value = 200, total_with_vat = 246 WHERE id = _expense_id;
  SELECT net_value, gross_value INTO _tmp_net, _tmp_gross FROM member_payments WHERE id = _payment_id;
  RETURN QUERY SELECT 'T3: Valor despesa→pagamento'::text, '200/246'::text, _tmp_net::text||'/'||_tmp_gross::text, _tmp_net = 200 AND _tmp_gross = 246;

  -- TESTE 4: Atualizar status pagamento → propaga à despesa
  UPDATE member_payments SET status = 'pago_falta_fatura' WHERE id = _payment_id;
  SELECT status INTO _tmp_status FROM financial_expenses WHERE id = _expense_id;
  RETURN QUERY SELECT 'T4: Status pagamento→despesa'::text, 'pago_falta_fatura'::text, _tmp_status, _tmp_status = 'pago_falta_fatura';

  -- TESTE 5: Atualizar valor pagamento → propaga à despesa
  UPDATE member_payments SET net_value = 300, gross_value = 369 WHERE id = _payment_id;
  SELECT base_value, total_with_vat INTO _tmp_net, _tmp_gross FROM financial_expenses WHERE id = _expense_id;
  RETURN QUERY SELECT 'T5: Valor pagamento→despesa'::text, '300/369'::text, _tmp_net::text||'/'||_tmp_gross::text, _tmp_net = 300 AND _tmp_gross = 369;

  -- TESTE 6: Eliminar despesa → pagamento eliminado em cascata
  DELETE FROM financial_expenses WHERE id = _expense_id;
  SELECT EXISTS(SELECT 1 FROM member_payments WHERE id = _payment_id) INTO _exists;
  RETURN QUERY SELECT 'T6: Cascata delete despesa'::text, 'false'::text, _exists::text, NOT _exists;

  -- TESTE 7: Re-ligação automática (criar despesa SEM member_id, depois atualizar)
  INSERT INTO financial_expenses (
    expense_name, location, category, base_value, total_with_vat,
    expense_month, expense_year, source_type, status
  ) VALUES (
    '__test_exp2_'||_ts, 'lisboa', 'recursos_humanos', 50, 50,
    2, 2026, 'contract', 'por_pagar'
  ) RETURNING id INTO _expense_id;

  UPDATE financial_expenses SET member_id = _member_id WHERE id = _expense_id;
  SELECT EXISTS(SELECT 1 FROM member_payments WHERE member_id = _member_id AND month = 2 AND year = 2026) INTO _exists;
  RETURN QUERY SELECT 'T7: Re-ligação ao definir member_id'::text, 'true'::text, _exists::text, _exists;

  -- TESTE 8: Eliminar pagamento → despesa eliminada em cascata
  SELECT id INTO _payment_id FROM member_payments WHERE member_id = _member_id AND month = 2 AND year = 2026;
  DELETE FROM member_payments WHERE id = _payment_id;
  SELECT EXISTS(SELECT 1 FROM financial_expenses WHERE id = _expense_id) INTO _exists;
  RETURN QUERY SELECT 'T8: Cascata delete pagamento'::text, 'false'::text, _exists::text, NOT _exists;

  -- Cleanup
  DELETE FROM member_payments WHERE member_id = _member_id;
  DELETE FROM financial_expenses WHERE member_id = _member_id;
  DELETE FROM team_members WHERE id = _member_id;
END;
$$;