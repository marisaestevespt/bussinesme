-- Cascade DELETE: despesa -> pagamento (com guard)
CREATE OR REPLACE FUNCTION public.cascade_delete_expense_to_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Evitar recursão se já estamos numa cascata
  IF current_setting('app.skip_payment_sync', true) = 'on' THEN
    RETURN OLD;
  END IF;

  IF OLD.member_id IS NOT NULL 
     AND OLD.source_type IN ('contract', 'contractor', 'salary', 'member_payment') THEN
    PERFORM set_config('app.skip_payment_sync', 'on', true);
    DELETE FROM public.member_payments
    WHERE member_id = OLD.member_id
      AND month = OLD.expense_month
      AND year = OLD.expense_year;
    PERFORM set_config('app.skip_payment_sync', 'off', true);
  END IF;
  RETURN OLD;
END;
$$;

-- Cascade DELETE: pagamento -> despesa (com guard)
CREATE OR REPLACE FUNCTION public.cascade_delete_payment_to_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.skip_payment_sync', true) = 'on' THEN
    RETURN OLD;
  END IF;

  PERFORM set_config('app.skip_payment_sync', 'on', true);
  DELETE FROM public.financial_expenses
  WHERE member_id = OLD.member_id
    AND expense_month = OLD.month
    AND expense_year = OLD.year
    AND source_type IN ('contract', 'contractor', 'salary', 'member_payment');
  PERFORM set_config('app.skip_payment_sync', 'off', true);
  RETURN OLD;
END;
$$;

-- Sync expense -> payment (com guard)
CREATE OR REPLACE FUNCTION public.sync_expense_to_member_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment_type text;
BEGIN
  IF current_setting('app.skip_payment_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

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

  PERFORM set_config('app.skip_payment_sync', 'on', true);
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
  PERFORM set_config('app.skip_payment_sync', 'off', true);

  RETURN NEW;
END;
$$;

-- Sync payment -> expense (com guard)
CREATE OR REPLACE FUNCTION public.sync_member_payment_to_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.skip_payment_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.skip_payment_sync', 'on', true);
  UPDATE public.financial_expenses
  SET 
    base_value = NEW.net_value,
    total_with_vat = NEW.gross_value,
    status = NEW.status,
    updated_at = now()
  WHERE member_id = NEW.member_id
    AND expense_month = NEW.month
    AND expense_year = NEW.year
    AND source_type IN ('contract', 'contractor', 'salary', 'member_payment');
  PERFORM set_config('app.skip_payment_sync', 'off', true);

  RETURN NEW;
END;
$$;