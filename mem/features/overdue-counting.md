---
name: Overdue counting rules
description: Rules to consistently count and label "Em atraso" (overdue) items across widgets, KPIs and groupings
type: feature
---

## Overdue counting (single source of truth)

Always use these helpers — never inline `deadline < today`:
- `isTaskOverdue(task, now)` from `src/lib/taskStatus.ts` — already excludes done tasks (DONE_STATUSES) and handles missing deadlines.
- `countOverdue(tasks)` / `filterOverdue(tasks)` for aggregates.
- For UnifiedItem (multi-source), check both `i.deadline < today` AND `!i.completed`.

## Common bugs to avoid

1. **Grouping by deadline** must exclude done/completed items from the "atrasado" bucket. Otherwise tarefas concluídas com deadline passada inflam o KPI (caso real: 2 tarefas em atraso reportadas como 22 porque 18 done + 2 pending).
2. **`useUnifiedResponsibilities`** queries 6 (NPS), 7 (milestones), 8 (sales actions) tinham fugas:
   - NPS e ações comerciais não têm responsável individual → só visíveis a Owner.
   - Milestones têm `responsible_id` → membros só veem onde são responsáveis; Owner vê tudo.
3. Rótulos: "Em atraso" deve significar pendente + deadline passada, nunca apenas "deadline passada".

## Where this matters
- `src/pages/Secretaria.tsx` — KPI "Tarefas em atraso"
- `src/components/secretaria/SecretariaDia.tsx` — KPI "Em atraso"
- `src/components/secretaria/SecretariaProdutividade.tsx` — KPI "Tarefas em atraso"
- `src/components/secretaria/MyTasksTable.tsx` — agrupamento por deadline
- `src/components/secretaria/TaskCustomViews.tsx` — agrupamento por deadline
- `src/hooks/useUnifiedResponsibilities.tsx` — fonte agregada
