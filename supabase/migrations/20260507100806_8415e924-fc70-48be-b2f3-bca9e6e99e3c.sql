
-- Função: dado um supplier_id e um contrato, regenera despesas futuras (mês atual em diante)
CREATE OR REPLACE FUNCTION public.sync_supplier_expenses_from_contract(
  p_supplier_id uuid,
  p_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract record;
  v_supplier record;
  v_first_month date := date_trunc('month', CURRENT_DATE)::date;
  v_end_month date;
  v_iter date;
  v_year int;
  v_month int;
  v_base numeric;
  v_total numeric;
  v_vat numeric;
  v_includes boolean;
  v_payment_day int;
  v_day int;
  v_exp_date date;
  v_exists uuid;
  v_new_id uuid;
  v_description text;
  v_category text;
BEGIN
  SELECT * INTO v_supplier FROM public.suppliers WHERE id = p_supplier_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT monthly_value, payment_day, value_includes_vat, status, end_date
    INTO v_contract
    FROM public.member_contracts
   WHERE member_id = p_member_id
     AND contract_type IN ('prestacao_servicos','contrato_prestacao')
   ORDER BY created_at DESC
   LIMIT 1;

  -- Apaga despesas futuras existentes (mês atual em diante) deste supplier
  DELETE FROM public.financial_contractors
   WHERE expense_id IN (
     SELECT id FROM public.financial_expenses
      WHERE supplier_id = p_supplier_id
        AND source_type = 'contractor'
        AND make_date(expense_year, expense_month, 1) >= v_first_month
   );
  DELETE FROM public.financial_expenses
   WHERE supplier_id = p_supplier_id
     AND source_type = 'contractor'
     AND make_date(expense_year, expense_month, 1) >= v_first_month;

  -- Se contrato inexistente, inativo ou sem valor, não regerar
  IF v_contract IS NULL OR v_contract.status <> 'ativo' OR COALESCE(v_contract.monthly_value,0) <= 0 THEN
    RETURN;
  END IF;

  v_includes := COALESCE(v_contract.value_includes_vat, false);
  v_payment_day := COALESCE(v_contract.payment_day, 1);
  v_day := LEAST(v_payment_day, 28);
  v_vat := COALESCE(v_supplier.default_vat_rate, 0);

  IF v_includes AND v_vat > 0 THEN
    v_base := round((v_contract.monthly_value / (1 + v_vat/100.0))::numeric, 2);
    v_total := round(v_contract.monthly_value::numeric, 2);
  ELSE
    v_base := round(v_contract.monthly_value::numeric, 2);
    v_total := round((v_contract.monthly_value * (1 + v_vat/100.0))::numeric, 2);
  END IF;

  v_end_month := COALESCE(v_contract.end_date, v_supplier.contract_end_date);

  -- Gera 12 meses à frente (ou até end_date)
  v_iter := v_first_month;
  FOR i IN 0..11 LOOP
    v_iter := (v_first_month + (i || ' months')::interval)::date;
    IF v_end_month IS NOT NULL AND v_iter > date_trunc('month', v_end_month)::date THEN
      EXIT;
    END IF;
    v_year := EXTRACT(YEAR FROM v_iter)::int;
    v_month := EXTRACT(MONTH FROM v_iter)::int;
    v_exp_date := make_date(v_year, v_month, v_day);

    v_description := COALESCE(v_supplier.expense_description_template,
      'Pagamento — ' || v_supplier.name || ' — ' || lpad(v_month::text,2,'0') || '/' || v_year);
    v_category := CASE WHEN v_supplier.category = 'freelancer' THEN 'prestadores' ELSE 'fornecedores' END;

    INSERT INTO public.financial_expenses (
      description, category, base_value, vat_rate, total_with_vat,
      expense_date, status, source_type, expense_month, expense_quarter,
      expense_year, location, supplier_id, member_id
    ) VALUES (
      v_description, v_category, v_base, v_vat, v_total,
      v_exp_date, 'por_pagar', 'contractor', v_month, ceil(v_month::numeric/3)::int,
      v_year, COALESCE(v_supplier.location,'portugal'), p_supplier_id, p_member_id
    ) RETURNING id INTO v_new_id;

    INSERT INTO public.financial_contractors (
      contractor_name, month, year, value, service, location, status, expense_id
    ) VALUES (
      v_supplier.name, v_month, v_year, v_total,
      'Prestação de serviços', COALESCE(v_supplier.location,'portugal'),
      'por_pagar', v_new_id
    );
  END LOOP;
END;
$$;

-- Trigger: quando member_contracts muda, propaga
CREATE OR REPLACE FUNCTION public.tg_member_contract_sync_supplier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid;
BEGIN
  IF NEW.contract_type NOT IN ('prestacao_servicos','contrato_prestacao') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_supplier_id FROM public.suppliers
   WHERE member_id = NEW.member_id AND is_active = true
   ORDER BY created_at DESC LIMIT 1;

  IF v_supplier_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Atualiza datas de contrato no supplier
  UPDATE public.suppliers
     SET contract_end_date = NEW.end_date,
         updated_at = now()
   WHERE id = v_supplier_id;

  PERFORM public.sync_supplier_expenses_from_contract(v_supplier_id, NEW.member_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_contract_sync_supplier ON public.member_contracts;
CREATE TRIGGER trg_member_contract_sync_supplier
AFTER INSERT OR UPDATE OF monthly_value, payment_day, value_includes_vat, status, end_date
ON public.member_contracts
FOR EACH ROW
EXECUTE FUNCTION public.tg_member_contract_sync_supplier();
