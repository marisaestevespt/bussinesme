
-- Remove duplicate subscription expenses for April 2026, keeping the oldest one per source_id
DELETE FROM public.financial_expenses
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY source_id, expense_month, expense_year, source_type
      ORDER BY created_at ASC
    ) as rn
    FROM public.financial_expenses
    WHERE expense_month = 4 AND expense_year = 2026
      AND source_type IN ('subscription', 'contract')
      AND status != 'cancelado'
  ) ranked
  WHERE rn > 1
);

-- Also remove duplicate contract entries for Marisa Esteves with 0 value
DELETE FROM public.financial_expenses
WHERE expense_month = 4 AND expense_year = 2026
  AND source_type = 'contract'
  AND total_with_vat = 0
  AND description LIKE '%Marisa Esteves%';
