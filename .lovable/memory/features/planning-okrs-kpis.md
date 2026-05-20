---
name: Planning Metas (renamed from KPIs/KRs)
description: Fase 1 UI rename: KPI/KPR/Key Result → "Meta". Uma Meta = indicador permanente do dept com alvos anual/trimestral/mensal. Objetivos anuais associam Metas existentes (linked_kpi_id). Sem mudança de schema.
type: feature
---

## Linguagem na UI (importante)
- "KPIs do departamento" → **"Metas do departamento"**
- "Key Results" → **"Metas"** (associadas a objetivos)
- "Novo KPI" → **"Nova Meta"**
- "via KPI: X" → **"via Meta: X"**

## Schema (inalterado nesta fase)
- `department_kpis` continua a ser a tabela das Metas
- `objective_metrics.linked_kpi_id` continua a ligar KR↔Meta
- `planning_goals.metric_id` continua a ligar metas trimestrais a KRs específicos

## Fase 2 (feito)
- Diálogo "Associar Meta" com seletor Meta do dept no topo
- Header "Métricas" → "Metas associadas"
- Renomeações no MonthlyCockpit (Key Results → Metas, KPRs → Metas)

## Fase 3 (feito — UI)
- GoalsSection (ObjectiveDetailSheet): quando o objetivo tem Métricas com linked_kpi_id, esconde o botão "Nova Meta Mensal" e mostra desdobramento mensal read-only por Meta ligada, lido de department_kpi_monthly, com link "Editar no departamento →" para /planeamento/dep/[area]
- Se não há Meta ligada, mantém fluxo planning_goals legado

## Roadmap futuro
- Migrar KRs órfãos → Metas e dropar campos duplicados em objective_metrics
