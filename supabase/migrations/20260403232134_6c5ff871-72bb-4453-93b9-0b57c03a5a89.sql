
DELETE FROM public.financial_expenses
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY source_id, expense_month, expense_year, source_type
      ORDER BY created_at ASC
    ) as rn
    FROM public.financial_expenses
    WHERE source_type IN ('subscription', 'contract')
  ) ranked
  WHERE rn > 1
);

-- Remove contract entries with 0 value
DELETE FROM public.financial_expenses
WHERE source_type = 'contract' AND total_with_vat = 0;
