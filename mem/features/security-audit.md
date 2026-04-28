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

⏳ Pendente (próximas sessões):
- useWeeklyAlignData (15), useMemberSave (14)
- supabase/functions: ai-assistant (50), send-digest (29), daily-status-update (16), ai-insights (16)
- Resto dos hooks (≤7 cada) e lib/

Validação: `bunx tsc --noEmit` clean, 105/105 testes a passar.
