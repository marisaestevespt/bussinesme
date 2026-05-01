CREATE OR REPLACE FUNCTION public.validate_recurring_child_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_rule public.financial_expenses%ROWTYPE;
  anchor_date date;
  months_diff integer;
  expected boolean := true;
BEGIN
  IF NEW.parent_expense_id IS NULL OR NEW.source_type IS DISTINCT FROM 'subscription' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_rule
  FROM public.financial_expenses
  WHERE id = NEW.parent_expense_id
    AND is_recurring = true
    AND source_type = 'rule';

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  anchor_date := parent_rule.renewal_date;

  IF anchor_date IS NULL THEN
    SELECT MIN(expense_date) INTO anchor_date
    FROM public.financial_expenses
    WHERE parent_expense_id = parent_rule.id
      AND is_recurring = false
      AND expense_date IS NOT NULL;
  END IF;

  IF anchor_date IS NULL OR parent_rule.periodicity IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.expense_year IS NULL OR NEW.expense_month IS NULL THEN
    RETURN NEW;
  END IF;

  months_diff := (NEW.expense_year - EXTRACT(YEAR FROM anchor_date)::integer) * 12
    + (NEW.expense_month - EXTRACT(MONTH FROM anchor_date)::integer);

  IF months_diff < 0 THEN
    expected := false;
  ELSE
    expected := CASE parent_rule.periodicity
      WHEN 'semanal' THEN true
      WHEN 'mensal' THEN true
      WHEN 'bimestral' THEN months_diff % 2 = 0
      WHEN 'trimestral' THEN months_diff % 3 = 0
      WHEN 'semestral' THEN months_diff % 6 = 0
      WHEN 'anual' THEN months_diff % 12 = 0
      ELSE true
    END;
  END IF;

  IF NOT expected THEN
    RAISE EXCEPTION 'Recurring expense % cannot be created for %/% because parent rule % is % anchored at %',
      COALESCE(NEW.description, NEW.expense_name, NEW.id::text),
      NEW.expense_month,
      NEW.expense_year,
      parent_rule.id,
      parent_rule.periodicity,
      anchor_date
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_recurring_child_period ON public.financial_expenses;
CREATE TRIGGER trg_validate_recurring_child_period
  BEFORE INSERT OR UPDATE OF parent_expense_id, source_type, expense_month, expense_year, expense_date
  ON public.financial_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_recurring_child_period();