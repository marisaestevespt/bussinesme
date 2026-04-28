
-- Auto-derive sale_month / sale_year / sale_quarter from payment_date
-- so no client code can ever orphan a sale by writing a partial update.
CREATE OR REPLACE FUNCTION public.sync_sale_period_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.payment_date IS NOT NULL THEN
    NEW.sale_year    := EXTRACT(YEAR  FROM NEW.payment_date::date)::int;
    NEW.sale_month   := EXTRACT(MONTH FROM NEW.payment_date::date)::int;
    NEW.sale_quarter := CEIL(EXTRACT(MONTH FROM NEW.payment_date::date) / 3.0)::int;
  ELSE
    -- Keep existing values if payment_date cleared (don't blow away history)
    IF TG_OP = 'INSERT' THEN
      NEW.sale_year    := NULL;
      NEW.sale_month   := NULL;
      NEW.sale_quarter := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_period_fields ON public.commercial_sales;
CREATE TRIGGER trg_sync_sale_period_fields
BEFORE INSERT OR UPDATE OF payment_date ON public.commercial_sales
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_period_fields();

-- Same idea for financial_expenses: derive expense_month/year from expense_date
CREATE OR REPLACE FUNCTION public.sync_expense_period_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.expense_date IS NOT NULL THEN
    NEW.expense_year  := EXTRACT(YEAR  FROM NEW.expense_date::date)::int;
    NEW.expense_month := EXTRACT(MONTH FROM NEW.expense_date::date)::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_expense_period_fields ON public.financial_expenses;
CREATE TRIGGER trg_sync_expense_period_fields
BEFORE INSERT OR UPDATE OF expense_date ON public.financial_expenses
FOR EACH ROW EXECUTE FUNCTION public.sync_expense_period_fields();

-- Backfill any orphaned sales with a payment_date but missing period fields
UPDATE public.commercial_sales
SET payment_date = payment_date
WHERE payment_date IS NOT NULL
  AND (sale_year IS NULL OR sale_month IS NULL OR sale_quarter IS NULL);
