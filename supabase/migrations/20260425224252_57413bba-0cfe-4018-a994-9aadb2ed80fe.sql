-- =========================================================
-- 1. SINCRONIZAÇÃO DE VALORES: financial_expenses -> member_payments
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_expense_to_member_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _payment_type text;
BEGIN
  -- Só processa despesas ligadas a membros
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_type NOT IN ('contract', 'contractor', 'salary', 'member_payment') THEN
    RETURN NEW;
  END IF;

  -- Resolver payment_type a partir do contrato ativo do membro
  SELECT CASE 
    WHEN tm.contract_type = 'recibos_verdes' THEN 'recibo_verde'
    WHEN tm.contract_type = 'contrato_trabalho' THEN 'salario'
    ELSE 'outro'
  END INTO _payment_type
  FROM public.team_members tm
  WHERE tm.id = NEW.member_id;

  -- UPSERT no member_payments
  INSERT INTO public.member_payments (
    member_id, month, year, payment_type,
    gross_value, net_value, status, payment_date
  )
  VALUES (
    NEW.member_id,
    NEW.expense_month,
    NEW.expense_year,
    COALESCE(_payment_type, 'outro'),
    COALESCE(NEW.gross_value, NEW.amount, 0),
    COALESCE(NEW.net_value, NEW.amount, 0),
    COALESCE(NEW.status, 'pendente'),
    NEW.expense_date
  )
  ON CONFLICT (member_id, month, year, payment_type)
  DO UPDATE SET
    gross_value = EXCLUDED.gross_value,
    net_value = EXCLUDED.net_value,
    status = EXCLUDED.status,
    payment_date = EXCLUDED.payment_date,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- =========================================================
-- 2. SINCRONIZAÇÃO DE VALORES: member_payments -> financial_expenses
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_member_payment_to_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.financial_expenses
  SET 
    gross_value = NEW.gross_value,
    net_value = NEW.net_value,
    amount = COALESCE(NEW.net_value, NEW.gross_value),
    status = NEW.status,
    updated_at = now()
  WHERE member_id = NEW.member_id
    AND expense_month = NEW.month
    AND expense_year = NEW.year
    AND source_type IN ('contract', 'contractor', 'salary', 'member_payment');

  RETURN NEW;
END;
$$;

-- =========================================================
-- 3. CASCATA NA ELIMINAÇÃO: financial_expenses -> member_payments
-- =========================================================
CREATE OR REPLACE FUNCTION public.cascade_delete_expense_to_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.member_id IS NOT NULL 
     AND OLD.source_type IN ('contract', 'contractor', 'salary', 'member_payment') THEN
    DELETE FROM public.member_payments
    WHERE member_id = OLD.member_id
      AND month = OLD.expense_month
      AND year = OLD.expense_year;
  END IF;
  RETURN OLD;
END;
$$;

-- =========================================================
-- 4. CASCATA NA ELIMINAÇÃO: member_payments -> financial_expenses
-- =========================================================
CREATE OR REPLACE FUNCTION public.cascade_delete_payment_to_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.financial_expenses
  WHERE member_id = OLD.member_id
    AND expense_month = OLD.month
    AND expense_year = OLD.year
    AND source_type IN ('contract', 'contractor', 'salary', 'member_payment');
  RETURN OLD;
END;
$$;

-- =========================================================
-- 5. Garantir UNIQUE constraint para o ON CONFLICT funcionar
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'member_payments_unique_member_period'
  ) THEN
    ALTER TABLE public.member_payments
    ADD CONSTRAINT member_payments_unique_member_period
    UNIQUE (member_id, month, year, payment_type);
  END IF;
END $$;

-- =========================================================
-- 6. Recriar/Garantir Triggers
-- =========================================================

-- INSERT/UPDATE em financial_expenses -> member_payments
DROP TRIGGER IF EXISTS trg_sync_expense_to_member_payment ON public.financial_expenses;
CREATE TRIGGER trg_sync_expense_to_member_payment
AFTER INSERT OR UPDATE ON public.financial_expenses
FOR EACH ROW
EXECUTE FUNCTION public.sync_expense_to_member_payment();

-- UPDATE em member_payments -> financial_expenses
DROP TRIGGER IF EXISTS trg_sync_member_payment_to_expense ON public.member_payments;
CREATE TRIGGER trg_sync_member_payment_to_expense
AFTER UPDATE ON public.member_payments
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.gross_value IS DISTINCT FROM NEW.gross_value
  OR OLD.net_value IS DISTINCT FROM NEW.net_value
)
EXECUTE FUNCTION public.sync_member_payment_to_expense();

-- DELETE em financial_expenses -> member_payments
DROP TRIGGER IF EXISTS trg_cascade_delete_expense_to_payment ON public.financial_expenses;
CREATE TRIGGER trg_cascade_delete_expense_to_payment
BEFORE DELETE ON public.financial_expenses
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_expense_to_payment();

-- DELETE em member_payments -> financial_expenses
DROP TRIGGER IF EXISTS trg_cascade_delete_payment_to_expense ON public.member_payments;
CREATE TRIGGER trg_cascade_delete_payment_to_expense
BEFORE DELETE ON public.member_payments
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_payment_to_expense();