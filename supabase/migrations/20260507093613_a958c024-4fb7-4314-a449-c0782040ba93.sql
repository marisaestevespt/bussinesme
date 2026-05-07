
-- 1. Apagar a despesa-filha duplicada de Maio 2026 (a regra mal-formada gerou-a a duplicar com ela própria)
DELETE FROM public.financial_expenses
WHERE id = 'a81c2965-e5d0-4ebf-afa0-d399c4549b0f';

-- 2. Reconverter a linha mãe num template puro (rule), sem período preenchido
UPDATE public.financial_expenses
SET source_type = 'rule',
    expense_date = NULL,
    expense_month = NULL,
    expense_quarter = NULL,
    expense_year = NULL
WHERE id = '114ee1c3-2346-4aa1-beed-43cac982188e';
