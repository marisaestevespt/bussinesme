---
name: KPRs ↔ Objetivos
description: Modelo de KPRs com cadências múltiplas, value_source automático e ligação a objetivos anuais
type: feature
---
## Modelo

`department_kpis` ganhou:
- `objective_id` (FK -> executive_objectives, nullable) — liga o KPR a um objetivo anual
- `target_value` (mantido) — meta mensal padrão (override por mês via `department_kpi_monthly.target_value`)
- `quarterly_target` — meta por trimestre (igual em todos)
- `annual_target` — meta anual

`department_kpi_quarterly (kpi_id, year, quarter)` — overrides + actuals por trimestre (RLS aberto a authenticated, igual ao monthly).

## Sync KPR -> Planning Goal

Trigger `sync_kpr_monthly_to_planning_goal` (AFTER INSERT OR UPDATE em `department_kpi_monthly`):
- Se o KPR tem `objective_id`, faz upsert em `planning_goals (objective_id, period=YYYY-MM, period_type='mensal')` com `target_value`/`actual_value`.
- Anti-loop: GUC `app.kpr_sync` (ver memory `sync-anti-loop`).
- Constraint UNIQUE `planning_goals_objective_period_type_key (objective_id, period, period_type)` garante upsert idempotente.

## Auto value (frontend)

`useKpiAutoValueRange(year, startMonth, endMonth)` resolve `value_source` para qualquer janela de meses. `useKpiAutoValue(year, month)` é wrapper. `quarterRange(q)` devolve `[startMonth, endMonth]`.

`KPRsInline` (cockpit mensal): toggle M/T/A altera meta exibida e agrega actuals. Apenas a meta mensal é editável inline; trimestral/anual editam-se no `KpiForm`.

## Onde aparece

- Cockpit Mensal: `KPRsInline` em cada bloco de área (M/T/A toggle).
- Hubs operacionais (Comercial, Marketing, Financeiro, Clientes, Operação): `DepartmentKpiSummary` no topo (chips, mês corrente, link para detalhe).
- Weekly Align: secção `WeeklyAlignKprs` agrupada por área.
- `/executive/planeamento/[dept]` (DepartmentKpiDashboard): tabela completa anual.

## Form (KpiForm)

Em ambos `DepartmentKpiDashboard` e `DepartmentKpisSection`:
- Meta mensal / trimestral / anual (3 inputs)
- Objetivo anual associado (Select filtrado por area==department ou geral)
- Fonte do valor atual (`value_source` + `source_filter`)