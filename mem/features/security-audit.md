---
name: security-audit
description: Security and type-safety hardening sessions
type: feature
---
# Security & Hardening

## Sessão (Out 2026): Hardening security + perf
- xlsx → exceljs (lazy import) em exportContabilista
- CORS allowlist em `_shared/cors.ts` (lyrata.pt + prod + preview + localhost)
- Aplicado a 5 funções sensíveis: create-member, manage-access-password, update-user-email, reset-instance, seed-instance
- portal-upload: MIME whitelist + sanitizeFileName
- bun run verify (lint+types+test+build) + check:types script
- docs/bundle-analysis.md

## Sessão (Out 2026): Redução de `any` (Fase 1 — dados/edge)
**Estratégia faseada por módulo. Esta fase: hooks da camada de dados.**

✅ Completado:
- `src/types/planning.ts` (novo) — tipos derivados de `Tables<>` para o módulo planning
- `src/hooks/usePlanningData.tsx` — 40 → 0 `any` (mutations, callbacks, helpers)
- `src/hooks/useCeoCockpit.tsx` — 17 → 0 `any` (Pick<Tables<>> para sales/projects/tasks/leads/nps/content/expense)
- **Bug latente corrigido**: `useCeoCockpit` consultava `last_contact_date` em `crm_leads` (coluna inexistente). Corrigido para `next_followup`.
- `src/hooks/useWeeklyAlignData.tsx` — 15 → 0 `any` (Pick<Tables<>> para tasks/leads/clients/expenses/payroll/contracts)
- `src/hooks/useMemberSave.tsx` — 14 → 0 `any` (MemberFormPayload + ContractFormPayload, TablesInsert, narrowing de err)
- Edge functions hardened: ~111 → 3 `any` (alias `SupabaseAdmin = ReturnType<typeof createClient>` + `Row = Record<string, unknown>` para callbacks de filter/map/reduce; `err: any` → `err: unknown` + narrowing seguro):
  - `send-digest/index.ts` (29 → 0)
  - `daily-status-update/index.ts` (16 → 0)
  - `ai-insights/index.ts` (16 → 0)
  - `ai-assistant/index.ts` (50 → 1, mantido `applyFilter(query: any)` por tipos opacos do query builder)

**Bugs latentes detetados (não corrigidos nesta passagem)**:
- `useMemberSave`: insert em `financial_contractors` usa colunas (`collaborator_name`, `invoice_value`, `vat_value`, `total_cost`) que NÃO existem no schema (`contractor_name`, `value`). Mantido `as unknown as TablesInsert<>` para preservar comportamento; criar tarefa de fix futuro.
- `member_contracts.contracted_hours` é `text` na DB; agora convertido explicitamente via `String()`.

⏳ Pendente (próximas sessões):
- Phase 3: cauda longa (~36 `any` em 20 ficheiros, ≤7 cada) — hooks `useUnifiedResponsibilities`, `useGlobalAgendaContext`, `useCommercialData`, `usePortalBranding`, `useInfiniteSupabaseQuery`, etc.
- Fix dos campos errados em `financial_contractors` insert (useMemberSave)

## Sessão (Out 2026): Redução de `any` (Fase 2 — top hooks/lib restantes)
✅ Completado:
- `src/hooks/useSecretariaCustomViews.tsx` — 7 → 0 (TablesInsert/Update + Json para columns/filters)
- `src/hooks/useProjectDetailData.ts` — 7 → 0 (Pick<> para time_entries; remoção de `(supabase as any)` em phases/deliverables)
- `src/hooks/useMyAgendaEvents.tsx` — 6 → 0 (EventRow/MeetingLite/SalesActionLite + AgendaEvent narrowing)
- `src/lib/exportContabilista.ts` — 10 → 0 (BusinessShape + AnyRow + helpers `cell()`/`s()`/`num()` para coerção segura de dados heterogéneos; tipo Workbook do exceljs)
- `src/lib/paymentGenerator.ts` — 3 → 0 (TablesInsert<'commercial_sales'> como PaymentEntry)
- `src/lib/paymentMethods.ts` — 3 → 0 (RawPaymentMethod interface)
- `src/hooks/useAutoCalendarLabels.tsx` — 3 → 0 (Json + narrowing seguro)
- `src/hooks/useDigestSettings.tsx` — 3 → 0 (TablesInsert/Update + Json)
- `src/hooks/usePermissions.tsx` — 3 → 0 (custom_role_id agora vem tipado do schema)

Validação: `bunx tsc --noEmit` clean, 105/105 testes a passar. Total acumulado: ~213 `any` removidos em 17 ficheiros.

Validação: `bunx tsc --noEmit` clean, 105/105 testes a passar.

## Sessão (Out 2026): Redução de `any` (Fase 3 — cauda longa)
✅ Completado:
- `src/hooks/useAbsenceCoverage.tsx` — payload tipado com `TablesInsert`/`TablesUpdate<'absence_coverage'>`
- `src/hooks/useUnifiedResponsibilities.tsx` — narrowing dos joins `clients(full_name)` em NPS/milestones
- `src/hooks/useDepartmentColors.ts` — forEach inferido do schema (sem cast)
- `src/hooks/useProductColors.tsx` — `ProductColorRow` (Json para branding) + helper `readPrimaryColor`
- `src/hooks/useBusinessSettings.tsx` — `use_system_theme` agora vem tipado do schema
- `src/hooks/usePortalBranding.ts` — alias `RpcFn` substitui `(supabase as any).rpc`
- `src/hooks/useInfiniteSupabaseQuery.tsx` — `SupabaseFilterBuilder`/`SupabaseFromFn` tipam o builder genérico
- `src/hooks/useCrmLabels.tsx` — forEach inferido do schema
- `src/hooks/useFinancialCategories.tsx` — TablesInsert
- `src/hooks/useStrategicMetrics.tsx` — narrowing local da despesa em CAC
- `src/hooks/useCommercialData.tsx` — narrowing `{ product?: string|null }` e `{ product_id? }`
- `src/hooks/useGlobalAgendaContext.tsx` — `GlobalEventRow` (Pick<Tables<'events'>>)
- `src/hooks/usePublicoAlvoData.tsx` — TablesInsert/Update
- `src/hooks/useSectorConfig.tsx` — `business_sector` agora vem tipado
- `src/lib/auditLog.ts` — `Json` para metadata RPC
- `src/lib/vatCalculations.ts` — narrowing local em filterByMonth
- `src/lib/expandRecurringEvents.ts` + `src/lib/portalAutoFill.ts` — `[key: string]: unknown`
- `src/hooks/useMyAgendaEvents.tsx` — duplo cast via `unknown` no expandRecurringEvents (efeito colateral do AnyEvent ficar mais estrito)

Validação: `bunx tsc --noEmit` clean, 105/105 testes a passar.
Total acumulado das 3 fases: **~232 `any` removidos em 35 ficheiros**.
Restante: apenas 1 `any` intencional em `ai-assistant/index.ts` (`applyFilter(query: any)` por opacidade do query builder do Deno) e 11 em ficheiros de teste (`*.test.ts`).

## Sessão (Out 2026): Fase 4 — Bug fix + testes
✅ Completado:
- **Bug fix `useMemberSave`**: insert em `financial_contractors` corrigido para usar colunas reais do schema (`contractor_name`, `value`, `location`) em vez de campos legados (`collaborator_name`, `invoice_value`, `vat_value`, `total_cost`). Agora usa `satisfies TablesInsert<>` (sem cast).
- **Testes hardened**: removidos os 11 `any` em `vatCalculations.test.ts`, `salesCalculations.test.ts`, `FinMensal.test.ts` via tipos parciais locais (`SaleLike`, `ExpenseLike`, `SubscriptionLike`).

Total final: **~243 `any` removidos em 38 ficheiros**. Resta apenas 1 `any` intencional em `ai-assistant` (query builder opaco). Build limpo, 105/105 testes a passar.
