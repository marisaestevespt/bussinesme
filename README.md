# Lyrata — Plataforma de Gestão Operacional

Sistema interno (PT-PT, "tu") para gestão de operações, clientes, marketing,
comercial, financeiro e RH de pequenas e médias agências/serviços.
Construído na Lovable Cloud com React + Vite + Tailwind + Supabase.

---

## 1. Stack técnico

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite 5, TypeScript 5, Tailwind v3, shadcn/ui |
| Estado servidor | TanStack Query v5 (cache 30s, gcTime 5min, retry 1) |
| Estado cliente | React Context (Auth, BusinessSettings, ActiveTimer, etc.) |
| Routing | react-router-dom v6 (lazy-loaded por rota) |
| Backend | Lovable Cloud (Supabase managed) — Postgres + Auth + Storage + Edge Functions |
| Cron | pg_cron + pg_net + Supabase Vault para autenticação |
| Email | Resend via `process-email-queue` (Edge Function) |
| AI | Lovable AI Gateway (Gemini, GPT-5 — sem API keys do utilizador) |
| Testes | Vitest (unit) + Playwright (e2e smoke) |

## 2. Arquitetura geral

```
┌──────────────────────────────────────────────────────────────────┐
│                      Browser (React SPA)                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Pages (60+) │  │  Hooks (30+) │  │ Components │  │  Contexts  │  │
│  │ lazy-loaded │  │ TanStack Q  │  │  shadcn/ui │  │  AuthProv. │  │
│  └─────┬──────┘  └──────┬──────┘  └─────┬──────┘  └─────┬──────┘  │
└────────┼────────────────┼────────────────┼───────────────┼────────┘
         │                │                │               │
         └────────────────┴───────┬────────┴───────────────┘
                                  │
                       ┌──────────▼─────────┐
                       │  Supabase Client   │
                       │  (anon JWT + RLS)  │
                       └──────────┬─────────┘
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      │                           │                           │
┌─────▼──────┐            ┌───────▼────────┐          ┌───────▼─────┐
│  Postgres  │            │  Edge Funcs    │          │   Storage    │
│  + RLS     │◄───────────┤ (Deno, 23x)    ├──────────►   buckets    │
│  app_role  │            │ resilience.ts  │          │  +RLS path/  │
│  has_role  │            │ cron-auth.ts   │          │  user folder │
└─────┬──────┘            └───────┬────────┘          └──────────────┘
      │                           │
      │                           │  pg_cron (UTC) ─► dispara via pg_net
      │                           │  ai gateway   ─► Lovable AI
      │                           │  resend       ─► email queue
      └─── pg_cron + pg_net ──────┘
```

Diagrama Mermaid completo: ver `docs/architecture.mmd`.

## 3. Estrutura de pastas

```
src/
  pages/             # rotas (todas lazy-loaded em src/App.tsx)
  components/        # UI por domínio (operacao/, tasks/, marketing/, ...)
  hooks/             # data hooks (TanStack Query) + UI hooks
  lib/               # pure utils + lógica de negócio (testável)
  integrations/supabase/  # client + types (AUTO-GERADOS, não editar)
  test/              # setup vitest
supabase/
  functions/         # 23 edge functions (Deno)
  migrations/        # SQL versionadas (read-only — criar nova migration)
  config.toml        # configuração das edge functions
tests/               # smoke tests Playwright
docs/                # documentação técnica + diagramas
```

## 4. Fluxos principais

- **Auth**: email/password + Google OAuth. RLS força `auth.uid()` em quase tudo.
  Roles em `user_roles` (NUNCA na tabela profiles) — função `has_role()` SECURITY DEFINER.
- **Onboarding**: `SetupPage` quando `business_settings` incompleto.
- **Suspensão**: `useSuspensionCheck` bloqueia app se conta suspensa.
- **Portal cliente**: `/portal/:token` (auth OTP separada de `auth.users`).
- **Cron jobs**: 11 schedules ativos em pg_cron (ver §6).
- **Paginação**: `useInfiniteSupabaseQuery` + `InfiniteScrollList` para evitar limite 1000 rows do Supabase.

## 5. Edge Functions (23)

Ver detalhes completos em [`docs/edge-functions.md`](./docs/edge-functions.md).

| Categoria | Funções |
|---|---|
| **Cron** | `daily-status-update`, `daily-birthday-check`, `check-nps-tasks`, `check-renewal-status`, `generate-routine-tasks`, `generate-deliverable-tasks`, `generate-monthly-report`, `send-payment-reminders`, `send-digest`, `process-email-queue`, `run-backup` |
| **AI** | `ai-assistant`, `ai-insights`, `analyze-hiring-simulation` |
| **Auth/Membros** | `create-member`, `generate-invite-link`, `update-user-email`, `manage-access-password`, `auth-email-hook` |
| **Portal** | `portal-upload` |
| **Operacional** | `health-check`, `reset-instance`, `seed-instance` |

Padrões partilhados:
- `_shared/cron-auth.ts` — valida JWT issuer + role para chamadas de pg_cron.
- `_shared/resilience.ts` — wrapper de retry/timeout/circuit-breaker para chamadas externas.
- `_shared/transactional-email-templates/` — JSX para emails (registry pattern).

## 6. Cron jobs ativos

| Job | Cron (UTC) | O que faz |
|---|---|---|
| `process-email-queue` | every 5s (se queue não vazia) | envia emails via Resend |
| `weekly-backup` | `0 3 * * 0` | snapshot semanal (Domingo 03:00) |
| `generate-routine-tasks` | `0 6 * * *` | tarefas diárias de rotinas |
| `generate-deliverable-tasks` | `0 5 1 * *` | tarefas dos entregáveis (mensal) |
| `generate-monthly-report` | `0 6 2 * *` | relatório mensal (dia 2) |
| `daily-birthday-check` | `30 7 * * *` | aniversários (clientes/equipa) |
| `send-payment-reminders-daily` | `0 8 * * *` | lembretes de pagamento |
| `daily-status-update` | `0 8 * * *` | status vendas, renovações, capacidade, payroll, NPS, alerts |
| `check-nps-tasks` | `0 9 * * *` | criar tarefas NPS pendentes |
| `check-renewal-status` | `15 9 * * *` | clientes em renovação |
| `send-digest-daily` | `0 18 * * 1-5` | digest fim-de-dia (seg-sex) |

Autenticação: todas usam `email_queue_service_role_key` do Supabase Vault, validado por `_shared/cron-auth.ts`.

## 7. Comandos

```bash
bun install                  # deps
bun run dev                  # dev server (Vite, port 8080)
bun run build                # build produção
bunx vitest run              # unit tests
bunx playwright test         # smoke tests (precisa preview a correr)
```

## 8. Convenções

- **Design tokens**: nunca usar cores literais (`text-white`, `bg-black`). Usar tokens
  semânticos (`text-foreground`, `bg-primary`) — ver `src/index.css` + `tailwind.config.ts`.
- **PT-PT informal** ("tu") em todo o copy. Ver `mem://design/microcopy.md`.
- **Tipos Supabase**: `src/integrations/supabase/types.ts` é AUTO-GERADO — nunca editar.
- **Migrations**: ficheiros em `supabase/migrations/` são read-only — criar nova com timestamp.
- **RLS first**: qualquer tabela nova tem que ter RLS + policies antes do merge.
- **Roles**: usar sempre `has_role(auth.uid(), 'role')` em policies, nunca `profiles.role`.

## 9. Auditoria técnica

Histórico de auditorias completas em `mem://features/security-audit.md` e
`mem://features/system-efficiency.md`. Última auditoria: Abril 2026
(5 fases + hardening de segurança final + performance/UX/docs).

---

## URL & Deploy

- **Preview**: https://id-preview--c24284e3-0c07-4f6e-ba4d-f58463326a8d.lovable.app
- **Produção**: https://bussinesme.lovable.app
- Project ID Lovable: `c24284e3-0c07-4f6e-ba4d-f58463326a8d`
