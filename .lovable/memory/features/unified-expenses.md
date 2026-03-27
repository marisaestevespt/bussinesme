---
name: Unified expenses model
description: financial_subscriptions merged into financial_expenses with is_recurring flag, periodicity, monthly_equivalent, expense_name columns
type: feature
---
## Unified Expenses Model (2026-03-27)

Subscriptions (financial_subscriptions) have been merged into financial_expenses.

### New columns on financial_expenses:
- `periodicity` (text): semanal, mensal, bimestral, trimestral, semestral, anual
- `renewal_date` (date): optional renewal tracking
- `monthly_equivalent` (numeric): auto-calculated from base_value + periodicity
- `expense_name` (text): display name (replaces old platform_name)

### How it works:
- Recurring expenses: `is_recurring = true` + `periodicity` set
- One-off expenses: `is_recurring = false` (or null)
- Hook: `useFinancialData()` returns `recurringExpenses` query (replaces old `subscriptions`)
- Mutations: `upsertRecurringExpense` / `deleteRecurringExpense`
- FinSetupFinanceiro shows recurring expenses with SupplierSelect
- FinMensal checks recurring expenses due per month via getSubscriptionOccurrences()
- FinPrevisibilidade uses recurring expenses for forecasting

### Legacy:
- financial_subscriptions table still exists but is no longer used by the app
- Old subscription data was migrated with source_type='subscription'
