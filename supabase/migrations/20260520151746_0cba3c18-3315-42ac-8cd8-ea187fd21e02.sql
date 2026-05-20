-- Fix Jéssica Silva contract: 40€ é base, IVA é adicional (total 49,20€)
UPDATE public.member_contracts
SET value_includes_vat = false
WHERE member_id = '1ff0b773-2edd-4ad1-9489-11e5dbd87f63';

-- Recalcular despesas associadas: base 40 + 23% IVA = 49,20
UPDATE public.financial_expenses
SET base_value = 40.00,
    vat_rate = 23,
    total_with_vat = 49.20
WHERE member_id = '1ff0b773-2edd-4ad1-9489-11e5dbd87f63'
  AND source_type = 'contractor';

-- Atualizar member_payments para refletir o valor líquido a pagar ao prestador
-- (gross_value mantém-se 40 como valor da fatura base; net_value passa a 49,20 = o que sai da conta)
UPDATE public.member_payments
SET gross_value = 40.00,
    net_value = 49.20
WHERE member_id = '1ff0b773-2edd-4ad1-9489-11e5dbd87f63';