-- 1. Add member_id column to financial_expenses for direct linkage
ALTER TABLE public.financial_expenses
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financial_expenses_member_id ON public.financial_expenses(member_id);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_member_period ON public.financial_expenses(member_id, expense_year, expense_month) WHERE member_id IS NOT NULL;

-- 2. Backfill member_id for existing expenses
-- 2a. From source_type='contract' with source_id pointing to member_contracts
UPDATE public.financial_expenses fe
SET member_id = mc.member_id
FROM public.member_contracts mc
WHERE fe.source_type = 'contract'
  AND fe.source_id = mc.id
  AND fe.member_id IS NULL;

-- 2b. From description matching "Pagamento — {member_name} — MM/YYYY"
UPDATE public.financial_expenses fe
SET member_id = tm.id
FROM public.team_members tm
WHERE fe.member_id IS NULL
  AND fe.source_type IN ('contract','contractor','member_payment')
  AND fe.description ILIKE 'Pagamento — ' || tm.full_name || ' — %';

-- 2c. Also backfill where description starts with member name "{name} — Month YYYY"
UPDATE public.financial_expenses fe
SET member_id = tm.id
FROM public.team_members tm
WHERE fe.member_id IS NULL
  AND fe.source_type IN ('contract','contractor','member_payment')
  AND fe.description ILIKE tm.full_name || ' — %';

-- 3. Trigger: when financial_expenses (linked to a member) changes status, sync member_payments
CREATE OR REPLACE FUNCTION public.sync_expense_to_member_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _contract_type text;
  _value numeric;
  _existing_id uuid;
BEGIN
  -- Only act when there is a linked member and we have month/year
  IF NEW.member_id IS NULL OR NEW.expense_month IS NULL OR NEW.expense_year IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only relevant source types
  IF NEW.source_type NOT IN ('contract','contractor','member_payment') THEN
    RETURN NEW;
  END IF;

  -- On UPDATE: only act if status changed (avoid recursion)
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.member_id IS NOT DISTINCT FROM OLD.member_id
     AND NEW.expense_month IS NOT DISTINCT FROM OLD.expense_month
     AND NEW.expense_year IS NOT DISTINCT FROM OLD.expense_year THEN
    RETURN NEW;
  END IF;

  -- Resolve contract type from active contract (fallback to 'salario')
  SELECT contract_type, monthly_value INTO _contract_type, _value
  FROM public.member_contracts
  WHERE member_id = NEW.member_id
  ORDER BY (status = 'ativo') DESC, created_at DESC
  LIMIT 1;

  _contract_type := COALESCE(_contract_type, 'salario');
  _value := COALESCE(_value, NEW.total_with_vat, 0);

  -- Find existing member_payments record for this period
  SELECT id INTO _existing_id
  FROM public.member_payments
  WHERE member_id = NEW.member_id
    AND month = NEW.expense_month
    AND year = NEW.expense_year
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.member_payments
    SET status = NEW.status,
        document_url = COALESCE(
          (SELECT (NEW.documents->0->>'url') WHERE jsonb_typeof(NEW.documents) = 'array' AND jsonb_array_length(NEW.documents) > 0),
          document_url
        ),
        updated_at = now()
    WHERE id = _existing_id;
  ELSE
    INSERT INTO public.member_payments (member_id, month, year, payment_type, gross_value, net_value, status)
    VALUES (NEW.member_id, NEW.expense_month, NEW.expense_year, _contract_type, _value, _value, NEW.status);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_expense_to_member_payment_trg ON public.financial_expenses;
CREATE TRIGGER sync_expense_to_member_payment_trg
AFTER INSERT OR UPDATE ON public.financial_expenses
FOR EACH ROW
EXECUTE FUNCTION public.sync_expense_to_member_payment();

-- 4. Trigger: when member_payments status changes, sync financial_expenses
CREATE OR REPLACE FUNCTION public.sync_member_payment_to_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _expense_id uuid;
BEGIN
  -- On UPDATE only act if status actually changed
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Find a matching financial_expense for this member+period
  SELECT id INTO _expense_id
  FROM public.financial_expenses
  WHERE member_id = NEW.member_id
    AND expense_month = NEW.month
    AND expense_year = NEW.year
    AND source_type IN ('contract','contractor','member_payment')
  ORDER BY created_at DESC
  LIMIT 1;

  IF _expense_id IS NOT NULL THEN
    UPDATE public.financial_expenses
    SET status = NEW.status, updated_at = now()
    WHERE id = _expense_id
      AND status IS DISTINCT FROM NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_member_payment_to_expense_trg ON public.member_payments;
CREATE TRIGGER sync_member_payment_to_expense_trg
AFTER INSERT OR UPDATE ON public.member_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_payment_to_expense();

-- 5. Backfill: align statuses for existing rows (expense status wins where mismatched)
UPDATE public.member_payments mp
SET status = fe.status, updated_at = now()
FROM public.financial_expenses fe
WHERE fe.member_id = mp.member_id
  AND fe.expense_month = mp.month
  AND fe.expense_year = mp.year
  AND fe.source_type IN ('contract','contractor','member_payment')
  AND mp.status IS DISTINCT FROM fe.status;