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

## Roadmap fase 2 (futuro, não feito ainda)
- Forçar ligação a Meta existente ao criar KR (esconder fluxo standalone)
- Esconder meta mensal em planning_goals quando há linked_kpi_id (vem do dept)
- Eventualmente: migrar KRs órfãos → Metas e dropar campos duplicados
