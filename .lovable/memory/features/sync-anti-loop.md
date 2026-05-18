---
name: Sync anti-loop pattern
description: Padrão GUC app.<key>_sync para evitar loops entre triggers bidirecionais de tabelas relacionadas
type: feature
---

# Anti-loop em triggers de sincronização

Pares bidirecionais usam um GUC de sessão `current_setting('app.<key>', true) = 'on'` no topo + `set_config('app.<key>', 'on'/'off', true)` à volta dos writes cross-table.

## Pares protegidos por GUC
- `app.deliv_task_sync` — sync_deliverable_to_task ↔ sync_task_status_to_deliverable
- `app.meet_deliv_sync` — sync_deliverable_date_to_meeting, sync_meeting_to_deliverable, sync_meeting_date_to_deliverable (sync_deliverable_meeting_link é BEFORE-only, sem write cross-table)
- `app.onb_task_sync` — sync_onboarding_to_task ↔ sync_task_status_to_onboarding
- `app.skip_payment_sync` — sync_expense_to_member_payment ↔ sync_member_payment_to_expense

## Pares protegidos por pg_trigger_depth
- meeting ↔ occurrence ↔ task: sync_meeting_to_occurrence, sync_occurrence_to_task_meeting, sync_task_to_occurrence (todas usam `IF pg_trigger_depth() > 1 THEN RETURN NEW`)
- planning ↔ departmental: sync_planning_to_departmental (usa pg_trigger_depth); sync_exec_objective_to_dept_goals é one-way (executive_objectives → financial_goals/marketing_goals, sem return path)

## Regra
Qualquer novo trigger bidirecional NOVO deve seguir o padrão GUC (preferido) ou pg_trigger_depth.