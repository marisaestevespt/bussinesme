# Memory: features/security-audit.md
Updated: 2026-03-29

Security audit: RLS hardening, cron auth guards, query safety, DB indexes.

## Architecture
- Single-tenant: each business = separate Supabase project. No business_id needed.
- Isolation is at infrastructure level, not database level.

## Fixes Applied (2026-03-25)
23 tables changed from `ALL USING (true)` to owner-only mutations + authenticated read.

## Fixes Applied (2026-03-29)

### Portal RLS Fix
- `client_portals` anon UPDATE policy now restricted via WITH CHECK — only `last_visit_at` can change (other columns must match existing values).

### Cron Edge Function Auth Guards
Added service-role auth check to 7 cron functions:
- daily-status-update, daily-birthday-check, check-nps-tasks, check-renewal-status
- generate-routine-tasks, generate-deliverable-tasks, send-digest
- Pattern: checks Authorization header contains SUPABASE_SERVICE_ROLE_KEY

### Query Safety (.single() → .maybeSingle())
Fixed ~18 dangerous `.single()` calls in SELECT queries that could throw 406 errors:
- Pages: ProjetoDetail, ReuniaoDetail, SopDetail, ChannelPage, ConteudoDetail, MarketingAutomacaoDetail, MarketingFunilDetail, MarketingChannelStrategy, TrafegoCriativoDetail, TrafegoReportDetail
- Components: UnifiedResponsibilitiesList, SecretariaTarefas, secretaria-shared
- Hooks: useActiveTimer, useDigestSettings, usePlanningRoutines

### Database Indexes
Added 25 indexes on hot columns:
- tasks: status, assigned_to, deadline, project_id
- clients: status
- projects: status, client_id
- meetings: date_time, client_id
- commercial_sales: client, status
- financial_expenses: status, expense_date, expense_month
- time_entries: member_id, entry_date, project_id
- notifications: user_id, read, created_at
- crm_leads: status, responsible_id
- team_members: status, profile_id
- sops: department

## Remaining USING(true) tables (by design)
Operational tables intentionally allow all authenticated members full CRUD — correct for single-tenant team app.
