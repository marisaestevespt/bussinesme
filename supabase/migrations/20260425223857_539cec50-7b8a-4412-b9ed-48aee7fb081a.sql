-- Backfill member_payments from financial_expenses that have member_id set but no payment record yet
INSERT INTO public.member_payments (member_id, month, year, payment_type, gross_value, net_value, status)
SELECT
  fe.member_id,
  fe.expense_month,
  fe.expense_year,
  COALESCE(
    (SELECT contract_type FROM public.member_contracts mc
     WHERE mc.member_id = fe.member_id
     ORDER BY (mc.status='ativo') DESC, mc.created_at DESC
     LIMIT 1),
    'salario'
  ) AS payment_type,
  fe.total_with_vat,
  fe.total_with_vat,
  fe.status
FROM public.financial_expenses fe
WHERE fe.member_id IS NOT NULL
  AND fe.expense_month IS NOT NULL
  AND fe.expense_year IS NOT NULL
  AND fe.source_type IN ('contract','contractor','member_payment')
  AND NOT EXISTS (
    SELECT 1 FROM public.member_payments mp
    WHERE mp.member_id = fe.member_id
      AND mp.month = fe.expense_month
      AND mp.year = fe.expense_year
  );