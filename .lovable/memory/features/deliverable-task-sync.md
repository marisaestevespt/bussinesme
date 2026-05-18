---
name: Deliverable-Task sync
description: Entregas e tarefas sincronizadas em ambos sentidos via triggers, com mapeamento canónico de 4 buckets de status
type: feature
---

# Sync Entregas ↔ Tarefas

## Triggers
- `sync_deliverable_to_task` (project_deliverables): cria/atualiza/apaga task conforme responsible_type e deliverable_type. Tipos `reuniao|link|documento|aprovacao` ou `is_meeting=true` não geram task.
- `sync_task_status_to_deliverable` (tasks): propaga task.status → deliverable.status.

## Mapeamento canónico de status (bidirecional)
| Task | ↔ | Deliverable |
|---|---|---|
| `por_comecar` | ↔ | `pendente` |
| `a_fazer` / `para_aprovacao` / `precisa_alteracoes` | ↔ | `em_progresso` |
| `aguarda_feedback` | ↔ | `aguarda_cliente` |
| `done` | ↔ | `concluido` |

Quando entrega vira `em_progresso` e a task atual já é um sub-estado válido (`a_fazer`/`para_aprovacao`/`precisa_alteracoes`), o sub-estado é preservado. Caso contrário usa `a_fazer` por defeito.

## Anti-loop
Ambos os triggers usam GUC `app.deliv_task_sync` ('on'/'off') para impedir re-entrada cruzada.

## Reconciliação
`reconcile_deliverable_tasks(_apply boolean)` deteta missing_task, orphan_task e status_drift. UI em Definições → Sistema.

## Coluna `tasks.estimated_time`
REMOVIDA no cleanup. Triggers usam apenas `estimated_minutes`. Nunca reintroduzir referência a `estimated_time` em funções/triggers.
