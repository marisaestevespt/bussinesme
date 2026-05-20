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

## Fase 2 (feito — UI)
- Diálogo "Associar Meta" (antes "Nova Métrica") em ObjectiveDetailSheet: seletor de Meta do dept no topo, em destaque
- Ao selecionar Meta: nome/unidade/alvo pré-preenchidos e bloqueados; cadência/fonte/produto/thresholds escondidos (vêm da Meta)
- Opção "criar métrica ad-hoc" continua disponível mas marcada como "não recomendado"
- Header da secção renomeado "Métricas de Acompanhamento" → "Metas associadas"

## Roadmap fase 3 (futuro)
- Esconder meta mensal em planning_goals quando objetivo tem Meta ligada (vem do dept)
- Migrar KRs órfãos → Metas e dropar campos duplicados
