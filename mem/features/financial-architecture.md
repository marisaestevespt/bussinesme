---
name: Financial module architecture
description: Centralized hooks for financial/commercial data. ALWAYS use the central hooks for writes; avoid direct Supabase calls.
type: feature
---
# Financial Module Architecture

## Central Hooks (use these for ALL writes)

- **`useFinancialData`** (`src/hooks/useFinancialData.tsx`) — owns `financial_expenses`. Provides `upsertExpense`, `deleteExpense`. Handles status normalization, period derivation, cache invalidation.
- **`useCommercialData`** (`src/hooks/useCommercialData.tsx`) — owns `commercial_sales`. Provides `upsertSale`, `deleteSale`. Auto-generates `sale_id`, computes month/quarter/year, invalidates cache.
- **`useBusinessSetupPaymentMethods`** (`src/hooks/useBusinessSetup.tsx`) — single source for `business_setup.payment_methods`. Single React Query cache key.
- **`useFinancialCategories`** (`src/hooks/useFinancialCategories.tsx`) — owns `financial_categories` (17 active records, 5 consumers).
- **`useSubscriptions`** (`src/hooks/useSubscriptions.tsx`) — owns `financial_subscriptions`. Auto-calculates `monthly_equivalent`.

## Rules

1. Never call `supabase.from('financial_expenses').insert/update/delete` directly — use `fin.upsertExpense` / `fin.deleteExpense`.
2. Never call `supabase.from('commercial_sales').insert/update/delete` directly — use `com.upsertSale` / `com.deleteSale`.
3. Never query `business_setup` directly for payment methods — use `useBusinessSetupPaymentMethods()`.
4. Direct SELECT queries are acceptable for narrow lookups; mutations always go through the hooks.

## Pages and routing

All financial sub-pages live under `/hub/financeiro/:section` via `FinanceiroSubPage.tsx` (lazy-loaded). Section cards defined in `src/components/financial/finOverview/sections.ts`.

Active sections: mensal, trimestral, entradas, saidas, ordenados, iva, seguranca-social, contabilidade, documentos, setup-financeiro (fornecedores), lista-produtos, subscricoes, metas-financeiras.

## Audit history

Phase A/B/C audit completed 2026-04-24: centralized payment methods, migrated all sales/expenses writes to hooks, built Subscrições UI from previously-unused table.
