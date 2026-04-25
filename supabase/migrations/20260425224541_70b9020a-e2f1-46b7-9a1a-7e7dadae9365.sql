-- Corrigir sync_expense_to_member_payment para usar colunas reais
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
    WHEN tm.contract_type = 'recibos_verdes' THEN 'recibo_verde'
    WHEN tm.contract_type = 'contrato_trabalho' THEN 'salario'
    ELSE 'outro'
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
    COALESCE(_payment_type, 'outro'),
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

-- Corrigir sync_member_payment_to_expense
CREATE OR REPLACE FUNCTION public.sync_member_payment_to_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

  RETURN NEW;
END;
$$;