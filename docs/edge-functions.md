# Edge Functions — Guia técnico

23 funções em `supabase/functions/`. Runtime: Deno. Deploy automático na Lovable Cloud.

## Padrões partilhados (`_shared/`)

- **`cron-auth.ts`** — `isAuthorizedCronCall(req)` valida o JWT (issuer + role
  service_role/anon/authenticated). Usado por todas as funções invocáveis via pg_cron.
- **`resilience.ts`** — `withRetry()`, `withTimeout()`, circuit-breaker simples para
  proteger chamadas externas (AI, Resend, APIs terceiras). Logs estruturados.
- **`transactional-email-templates/`** — templates JSX (React Email) + `registry.ts`
  com mapping `templateName → component`.
- **`email-templates/`** — templates de auth (signup, recovery, magic-link, etc.)
  consumidos por `auth-email-hook`.

## Inventário

### Cron jobs (11)

| Função | Schedule UTC | Responsabilidade |
|---|---|---|
| `process-email-queue` | every 5s if non-empty | drena `email_queue` → Resend |
| `run-backup` | `0 3 * * 0` | snapshot semanal de tabelas-chave |
| `generate-routine-tasks` | `0 6 * * *` | tarefas diárias a partir de `planning_routines` |
| `generate-deliverable-tasks` | `0 5 1 * *` | mensal — tarefas a partir de `project_deliverables` |
| `generate-monthly-report` | `0 6 2 * *` | gera relatório mensal e arquiva |
| `daily-birthday-check` | `30 7 * * *` | aniversários (D-30, D-15, dia D) |
| `send-payment-reminders` | `0 8 * * *` | lembretes de pagamentos a vencer |
| `daily-status-update` | `0 8 * * *` | **multi-job**: vendas, renovações, capacidade, payroll, NPS, alertas (ver detalhe abaixo) |
| `check-nps-tasks` | `0 9 * * *` | cria tarefas NPS pendentes por cadência do produto |
| `check-renewal-status` | `15 9 * * *` | clientes em janela de renovação |
| `send-digest` | `0 18 * * 1-5` | digest end-of-day (seg-sex) para owner + membros |

#### `daily-status-update` — sub-rotinas
1. Vendas overdue → `em_atraso`
2. Vendas do mês corrente → `aguarda_pagamento`
3. Clientes em renovação (`renewal_advance_days` do produto, default 30)
4. Notificação + tarefa por renovação
5. Contratos expirando (30 dias)
6. Capacity alert (≥90% das `expected_weekly_hours`)
7. Payroll → financial_expenses sync
8. NPS auto-generation
9. Meeting reminders do dia
10. Project deadline alerts
11. Recurring expenses (no `recurrence_day` do mês)
12. Overdue task alerts
13. Routine missed alerts
14. CRM follow-up overdue

### AI (3)
- `ai-assistant` — chat assistente (Lovable AI Gateway, default Gemini 2.5 Flash)
- `ai-insights` — insights periódicos sobre KPIs
- `analyze-hiring-simulation` — análise de simulação de contratação

### Auth & membros (5)
- `create-member` — cria utilizador via service role + perfil + role
- `generate-invite-link` — magic link de convite
- `update-user-email` — alteração de email com confirmação dupla
- `manage-access-password` — encripta/atualiza credenciais em `platform_accesses`
- `auth-email-hook` — render de templates de auth (substitui defaults)

### Portal cliente (1)
- `portal-upload` — upload de ficheiros de cliente para bucket `portal-files`

### Operacional (3)
- `health-check` — endpoint de status
- `reset-instance` — reset de instância para template (apenas owner mãe)
- `seed-instance` — popula instância nova com dados base

## Adicionar uma nova edge function

1. Criar `supabase/functions/<nome>/index.ts`.
2. Importar `_shared/cron-auth.ts` se for invocável por cron.
3. Wrappear chamadas externas com `_shared/resilience.ts`.
4. Se precisar de config não-default (ex: `import_map`), adicionar bloco em `supabase/config.toml`.
5. Deploy automático no próximo build da Lovable Cloud.

## Adicionar um cron job

SQL (via migration):

```sql
SELECT cron.schedule(
  'meu-job-nome',
  '0 9 * * *',  -- UTC
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/minha-func',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Validar com `SELECT * FROM cron.job;` e logs com `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;`.

## Debug

- Logs por função: ferramenta `supabase--edge_function_logs` ou consola Cloud.
- Cron failures: `cron.job_run_details` (status + return_message).
- Email queue stuck: ver `email_queue.status='failed'` + `last_error`.