
# Auditoria de consistência de dados — Plano

## Objetivo
Garantir que em todo o lado da app aparecem todos os campos esperados, sem buracos (como aconteceu com `project_name` / `client_name` em `meetings`).

O problema raiz é sempre o mesmo padrão: **colunas em cache** (`*_name`, `*_email`, `*_color`, etc.) numa tabela filha que deviam refletir a fonte original (`projects.name`, `clients.full_name`, `products.name`, …) mas ficaram dessincronizadas por:
- registos criados antes de existir o trigger de sincronização,
- importações / migrações antigas,
- updates feitos no código sem passar o `*_name`.

## Princípios da auditoria
1. **Read-only primeiro.** Cada fase começa só com `SELECT` — nada é alterado sem te mostrar o que está partido.
2. **Sem mexer em código aplicacional.** Nenhuma alteração a `.tsx` / `.ts` / hooks. Toda a correção é feita na BD (backfill + trigger), exatamente como em `meetings`.
3. **Triggers idempotentes.** `BEFORE INSERT OR UPDATE OF <fk>` na tabela filha + `AFTER UPDATE OF <name>` na tabela pai. Sempre `CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS`.
4. **Anti-loop respeitado.** Se a tabela já tiver o padrão `app.<key>_sync` ou `pg_trigger_depth()` (memória *sync-anti-loop*), seguimos a mesma convenção.
5. **Stop & report.** No fim de cada domínio mostro relatório (X linhas dessincronizadas em Y tabelas) e só avanço para correções depois de OK explícito.

## Critério único de "está partido"
Para cada par (`tabela_filha.fk_id`, `tabela_filha.cache_field`):
```
COUNT(*) FILTER (
  WHERE fk_id IS NOT NULL
    AND cache_field IS DISTINCT FROM (SELECT origem FROM pai WHERE id = fk_id)
) > 0
```
Se > 0 → candidato a backfill + trigger. Se = 0 → marcado como ✅ saudável.

## Fases (1 domínio = 1 mensagem minha com relatório)

### Fase 1 — Reuniões e Agenda  *(já parcialmente feito)*
- `meetings` (product/project/client) ✅ feito
- `meeting_participants` (profile_name, profile_email?)
- `meeting_projects` (snapshot do projeto)
- `events` / `event_members` (product_name, type label, profile name)

### Fase 2 — Tarefas, Rotinas, Tempo
- `tasks` (product_name, project_name, client_name, assignee_name)
- `routines` (product_name, area, assignee)
- `time_entries`, `task_time_entries` (member_name, task_title, project_name)

### Fase 3 — Projetos e Entregas
- `projects` (client_name, product_name)
- `project_deliverables` (product_name, project_name, responsible_name)
- `project_phases` / `project_recurring_occurrences` (project_name, phase_name)
- `project_members`, `project_responsibilities` (member_name)

### Fase 4 — Clientes / Portal
- `client_*` (client_name, product_name) — onboarding, offboarding, renewals, requests, feedback, history, NPS
- `portal_*` (client_name, project_name)
- `client_portals` (client_name, project_name)

### Fase 5 — Comercial / CRM
- `crm_leads` (pipeline_name, stage_name, source_name, owner_name)
- `crm_pipeline_leads`, `crm_lead_actions`, `crm_interactions`
- `commercial_sales` (product_name, client_name, lead_name)
- `commercial_*_goals` (product_name)

### Fase 6 — Produtos
- 26 tabelas `product_*` (product_name onde aplicável)
- Cross-check com a memória *product-name-sync* (11 tabelas já cobertas) → identificar as restantes que ainda não têm trigger.

### Fase 7 — Financeiro / Fiscal
- `financial_expenses`, `financial_payroll`, `financial_subscriptions`, `financial_documents` (category_name, contractor_name, supplier_name, client_name)
- `iva_payments`, `fiscal_*` (period label, member_name)
- `suppliers` referenciado

### Fase 8 — Equipa / RH
- `team_members` (role_name, department_name, work_area_name)
- `member_contracts`, `member_payments`, `member_onboarding` (member_name)
- `team_member_vacations`, `absence_coverage` (member_name, coverer_name)
- `performance_*` (member_name, department_name)

### Fase 9 — Planeamento / Executivo
- `planning_goals`, `planning_routines`, `planning_quarter_notes` (area, owner_name, department_name)
- `quarterly_plans`, `quarterly_items` (area_name, owner_name)
- `executive_*` (category_name, owner_name)
- `weekly_align_notes`, `monthly_reflection`, `monthly_reports`

### Fase 10 — Marca / Marketing / Conteúdos
- `brand_*` (15 tabelas — section_name, archetype_name)
- `marketing_*`, `content_*`, `channel_*`, `strategy_*` (channel_name, funnel_name, product_name, owner_name)
- `traffic_*` (campaign_name, channel_name)
- `website_pages`, `website_page_files`

### Fase 11 — Departamentos & KPIs
- `departments` (color_hex em cache?)
- `department_kpi_monthly`, `department_kpi_quarterly` (department_name, kpi_name)
- `kpi_settings`, `metric_history`

### Fase 12 — Restantes (SOPs, Inovação, Mural, AI, Lançamentos, Notificações, Emails)
- `sops` / `sop_steps` / `sop_step_documents` (category_name, owner_name)
- `innovation_*`, `training_*`
- `mural_posts` / `mural_comments` / `mural_reactions` (author_name)
- `ai_conversations` / `ai_messages` (user_name)
- `launch_data`, `launch_tasks`
- `notifications` (actor_name, target_label)
- `email_send_log`, `email_send_state`

## Entregável por fase
Para cada fase recebes uma mensagem com:
1. **Tabela-resumo** com colunas: `tabela.coluna_cache`, `total_registos`, `dessincronizados`, `nulos_com_fk`, status (✅ / ⚠️).
2. Para cada linha ⚠️: 3 exemplos reais (`id`, valor em cache, valor real).
3. Proposta de correção em SQL pronta a executar (backfill + trigger no padrão já usado em `meetings`), **só executada após confirmação tua**.

## O que esta auditoria **não** faz
- Não toca em componentes React nem em hooks.
- Não muda RLS, permissões, ou edge functions.
- Não apaga colunas, mesmo que pareçam órfãs.
- Não altera o schema (sem `ALTER TABLE`) na fase de diagnóstico.
- Não corre nada sem mostrar antes o relatório.

## Estimativa
12 fases. Cada fase = 1 ronda de queries + 1 relatório + (opcional) 1 migração de correção. Posso começar pela Fase 1 (concluir reuniões/agenda) assim que aprovares.
