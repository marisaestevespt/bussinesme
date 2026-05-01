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
  target_day integer;
  days_in_target_month integer;
  expected_date date;
BEGIN
  IF NEW.parent_expense_id IS NULL THEN
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
      AND source_type = 'subscription'
      AND is_recurring = false
      AND expense_date IS NOT NULL;
  END IF;

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
    IF NEW.expense_date IS NOT NULL THEN
      NEW.expense_year := EXTRACT(YEAR FROM NEW.expense_date)::integer;
      NEW.expense_month := EXTRACT(MONTH FROM NEW.expense_date)::integer;
      NEW.expense_quarter := CEIL(EXTRACT(MONTH FROM NEW.expense_date)::numeric / 3)::integer;
    ELSE
      RETURN NEW;
    END IF;
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

  target_day := COALESCE(parent_rule.recurrence_day, EXTRACT(DAY FROM anchor_date)::integer, 15);
  days_in_target_month := EXTRACT(DAY FROM (date_trunc('month', make_date(NEW.expense_year, NEW.expense_month, 1)) + interval '1 month - 1 day'))::integer;
  expected_date := make_date(NEW.expense_year, NEW.expense_month, LEAST(target_day, days_in_target_month));

  NEW.expense_date := expected_date;
  NEW.expense_quarter := CEIL(NEW.expense_month::numeric / 3)::integer;

  IF NEW.source_type IS NULL OR NEW.source_type <> 'subscription' THEN
    NEW.source_type := 'subscription';
  END IF;
  IF NEW.source_id IS NULL THEN
    NEW.source_id := parent_rule.id;
  END IF;

  RETURN NEW;
END;
$$;