---
name: Recurring expenses deduplication
description: Rules and constraints to prevent duplicate financial expenses, especially recurring ones (subscriptions, contracts)
type: feature
---

## Modelo invariável: regra ≠ despesa

Uma `financial_expenses` pode ser de dois tipos mutuamente exclusivos:

1. **Regra/template** (`is_recurring=true`, `source_type='rule'`)
   - É um molde para gerar despesas mensais. **NUNCA tem `expense_date`, `expense_month`, `expense_quarter` ou `expense_year`.** Estes campos são FORÇADOS a NULL pelo trigger `trg_validate_recurring_rule_no_period`.
   - Não aparece em vistas mensais — é filtrada como `source_type !== 'rule'`.

2. **Despesa do mês** (`is_recurring=false`)
   - Materialização concreta para um mês específico. Tem mês/ano obrigatórios.
   - Liga-se à regra via `parent_expense_id` E/OU `source_id` + `source_type` (subscription/contract).

## Constraints DB (defesa em camadas)

- `financial_expenses_parent_month_uq`: UNIQUE (parent_expense_id, year, month) WHERE parent IS NOT NULL.
- `financial_expenses_source_month_uq`: UNIQUE (source_type, source_id, year, month) WHERE source_id IS NOT NULL.
- `financial_expenses_supplier_month_value_uq`: UNIQUE (supplier_id, year, month, total_with_vat) WHERE supplier IS NOT NULL AND não é regra AND status<>'cancelado'. Apanha duplicados mesmo quando os parent/source IDs estão diferentes.
- Trigger `trg_validate_recurring_rule_no_period`: força que regras nunca tenham período preenchido.

## Bug histórico (2026-05-01) e como evitar

A regra era inserida com `expense_year/month` do mês corrente E imediatamente outra despesa-filho era inserida para o mesmo mês com `source_type='subscription'`. As duas linhas tinham chaves diferentes (rule vs subscription) e os índices únicos não as apanhavam. **Resultado: 7 fornecedores com despesa duplicada em vários meses.**

Solução: regras passaram a ser templates puros (sem período), constraint extra por `(supplier, year, month, total)` e trigger DB.

## Regra para futuro código

Sempre que inserir/atualizar uma `financial_expenses` recorrente:
- `is_recurring=true` + `source_type='rule'` → **NUNCA** definir `expense_date`, `expense_month`, `expense_quarter`, `expense_year`. (O trigger limpa, mas o código deve ser explícito.)
- A despesa do mês corrente é gerada **separadamente** como filho com `parent_expense_id` apontando para a regra.

## Locais críticos
- `src/pages/Fornecedores.tsx` — criação de regras de fornecedor
- `src/components/financial/FinSaidas.tsx` — formulário de despesas
- `src/components/financial/expenseDetail/useExpenseForm.ts` — edição
- `src/components/financial/FinMensal.tsx` — auto-materialização do mês
- `supabase/functions/daily-status-update/index.ts` — cron de geração mensal
