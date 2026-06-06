
-- Allow 'cancelado' status (was used in code but blocked by check constraint)
ALTER TABLE public.financial_expenses DROP CONSTRAINT IF EXISTS financial_expenses_status_check;
ALTER TABLE public.financial_expenses ADD CONSTRAINT financial_expenses_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'por_pagar'::text, 'pago_falta_fatura'::text, 'tudo_ok'::text, 'cancelado'::text]));

-- Trigger: deactivating a supplier cancels its recurring rule + future unpaid occurrences
CREATE OR REPLACE FUNCTION public.handle_supplier_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = false AND COALESCE(OLD.is_active, true) = true THEN
    UPDATE public.financial_expenses
    SET status = 'cancelado'
    WHERE supplier_id = NEW.id
      AND is_recurring = false
      AND (expense_date IS NULL OR expense_date >= CURRENT_DATE)
      AND status NOT IN ('tudo_ok', 'pago_falta_fatura', 'cancelado');

    UPDATE public.financial_expenses
    SET status = 'cancelado'
    WHERE supplier_id = NEW.id
      AND is_recurring = true
      AND status <> 'cancelado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_deactivation ON public.suppliers;
CREATE TRIGGER trg_supplier_deactivation
AFTER UPDATE OF is_active ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.handle_supplier_deactivation();

-- One-off cleanup for suppliers already inactive
UPDATE public.financial_expenses fe
SET status = 'cancelado'
FROM public.suppliers s
WHERE fe.supplier_id = s.id
  AND s.is_active = false
  AND fe.is_recurring = false
  AND (fe.expense_date IS NULL OR fe.expense_date >= CURRENT_DATE)
  AND fe.status NOT IN ('tudo_ok', 'pago_falta_fatura', 'cancelado');

UPDATE public.financial_expenses fe
SET status = 'cancelado'
FROM public.suppliers s
WHERE fe.supplier_id = s.id
  AND s.is_active = false
  AND fe.is_recurring = true
  AND fe.status <> 'cancelado';
