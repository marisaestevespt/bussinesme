---
name: recurring-expenses-dedup
description: Despesas recorrentes (subscriptions/contracts) são geradas por DOIS mecanismos — cron diário daily-status-update e cliente FinMensal — e DEVEM partilhar a mesma chave de dedupe (parent_expense_id) + constraint DB
type: feature
---
# Dedup de despesas recorrentes

## Por que existe esta regra
Despesas mensais recorrentes (Lovable, Anthropic, Google Workspace, salários,
etc.) são materializadas em `financial_expenses` por **dois caminhos
independentes**:

1. **Backend** — `supabase/functions/daily-status-update/index.ts`
   secção "recurring-expenses" (corre por `pg_cron` diariamente).
2. **Frontend** — `src/components/financial/FinMensal.tsx` `autoMaterialize`
   (corre quando o utilizador abre o mês corrente/passado).

Quando estes dois caminhos usam **chaves de dedupe diferentes**, criam
duplicados (caso real: Maio 2026 — 5 subscrições duplicadas).

## Regra
Toda despesa auto-gerada DEVE preencher **as duas chaves**:

```ts
{
  parent_expense_id: re.id,              // chave do cron (sempre)
  source_type: 'subscription'|'contract',// chave do cliente
  source_id: re.id,
}
```

E qualquer **verificação prévia de existência** deve aceitar correspondência
por `parent_expense_id` OU `(source_type, source_id)` no mesmo `(year, month)`.

## Salvaguarda final (DB)
Existem dois índices únicos parciais:

- `financial_expenses_parent_month_uq` em `(parent_expense_id, expense_year, expense_month)` quando `parent_expense_id IS NOT NULL`.
- `financial_expenses_source_month_uq` em `(source_type, source_id, expense_year, expense_month)` quando `source_id IS NOT NULL`.

Se algum caminho tentar inserir um duplicado, o Postgres devolve `23505` —
o cron trata como no-op e segue.

## Como aplicar quando adicionar um novo gerador
- Reutilizar `buildSubscriptionExpense` / `buildContractExpense`
  (`src/components/financial/finMensal/expenseBuilders.ts`) que já preenchem
  ambas as chaves.
- No backend, replicar o padrão da secção "recurring-expenses" do
  daily-status-update: dedup duplo + insert com ambas as chaves + tolerar 23505.
- Nunca criar uma terceira chave de dedupe (ex.: `description` + `amount`) —
  partir sempre de `(parent_expense_id, year, month)`.
