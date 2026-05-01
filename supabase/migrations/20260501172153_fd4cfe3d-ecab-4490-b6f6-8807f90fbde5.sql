-- 1) Apagar 5 despesas recorrentes duplicadas em Maio 2026 (mantém a mais antiga por chave de origem)
WITH g AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(source_id, parent_expense_id), expense_year, expense_month
      ORDER BY created_at
    ) AS rn
  FROM public.financial_expenses
  WHERE COALESCE(source_id, parent_expense_id) IS NOT NULL
)
DELETE FROM public.financial_expenses
WHERE id IN (SELECT id FROM g WHERE rn > 1);

-- 2) Índice único parcial: impede duas despesas com o mesmo parent_expense_id no mesmo mês/ano
CREATE UNIQUE INDEX IF NOT EXISTS financial_expenses_parent_month_uq
  ON public.financial_expenses (parent_expense_id, expense_year, expense_month)
  WHERE parent_expense_id IS NOT NULL;

-- 3) Índice único parcial equivalente para a chave (source_type, source_id)
CREATE UNIQUE INDEX IF NOT EXISTS financial_expenses_source_month_uq
  ON public.financial_expenses (source_type, source_id, expense_year, expense_month)
  WHERE source_id IS NOT NULL;