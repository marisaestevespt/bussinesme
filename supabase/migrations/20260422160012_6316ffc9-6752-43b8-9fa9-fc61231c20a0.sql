ALTER TABLE public.financial_expenses
ADD COLUMN IF NOT EXISTS vat_deductible_amount numeric;

COMMENT ON COLUMN public.financial_expenses.vat_deductible_amount IS 'Valor de IVA realmente dedutível (preenchido pela contabilista). Se NULL, assume IVA pago total = total_with_vat - base_value.';