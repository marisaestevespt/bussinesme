---
name: Planning OKRs vs KPIs
description: KPIs permanentes vivem em department_kpis (por departamento). KRs vivem em objective_metrics (com linked_kpi_id opcional). Metas de período (T1-T4 / mês) em planning_goals com metric_id opcional para ligar a KR específico.
type: feature
---

## Conceito
- **KPI** (department_kpis): métrica permanente do departamento (NPS, taxa de conversão...). Visível em /planeamento/dep/:dep via `<DepartmentKpisSection />`.
- **KR** (objective_metrics): Key Result mensurável dentro de um objetivo anual. Pode ter `linked_kpi_id` para puxar valor automaticamente de um KPI.
- **Meta de período** (planning_goals): target/actual para um período (T1, T2, Janeiro, ...). `metric_id` opcional liga a um KR específico em vez de só ao objetivo.

## Tabelas (migration 2026-05-20)
- `department_kpis` (RLS: leitura authenticated, escrita owner/admin)
- `objective_metrics.linked_kpi_id` → department_kpis(id) ON DELETE SET NULL
- `planning_goals.metric_id` → objective_metrics(id) ON DELETE CASCADE

## UI
- /planeamento?nivel=ano: cards mostram valor/target + lista compacta de KRs (PlanningObjectivesTab compact mode).
- /planeamento?nivel=trimestre: `QuarterlyObjectivesList` (lista por área → objetivos → KRs + metas trimestrais editáveis inline). Substituiu QuarterlyGallery.
- /planeamento/dep/:dep: `DepartmentKpisSection` no topo (CRUD inline).

## A fazer (próximo passe)
- Permitir escolher um KPI ao criar um KR (selector `linked_kpi_id`).
- Redesign do nível mensal + reparar métricas partidas (capacidade equipa, horas/cliente, entregas).
- Auto-sync `objective_metrics.current_value` quando `linked_kpi_id` definido.