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
- Resto dos hooks (≤7 cada) e lib/
- Fix dos campos errados em `financial_contractors` insert (useMemberSave)

Validação: `bunx tsc --noEmit` clean, 105/105 testes a passar.
