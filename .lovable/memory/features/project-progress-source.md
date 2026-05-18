---
name: Project progress source of truth
description: projects.progress é fonte única, mantida por trigger DB; UI deve LER, não recalcular
type: feature
---

# Progresso de projetos

## Fonte única
- Coluna `projects.progress` (0-100), atualizada pelo trigger `update_project_progress`
- Trigger dispara em INSERT/UPDATE/DELETE de: project_deliverables, project_phases, project_recurring_occurrences, tasks
- Lógica em `calculate_project_progress(_project_id)`:
  1. `cliente_servico_mensal` + `recorrente` → fases + ocorrências + tasks standalone do projeto
  2. Senão → entregas (todas) > fases (todas) > 0

## Regra UI
- LER `projects.progress` — nunca recalcular com dados parciais do React Query
- `computeProjectProgressFromSources` mantida em `src/lib/projectProgress.ts` apenas como referência da fórmula DB; não usar em novos componentes
- Lugares que leem `projects.progress`: ProjetoDetail (badge), Operacao (Saúde dos Projetos + listas)
