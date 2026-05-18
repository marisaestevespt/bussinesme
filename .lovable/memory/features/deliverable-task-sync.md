---
name: Deliverable-Task sync
description: Entregas com responsible_type=equipa auto-geram tarefas ligadas via trigger; conclusao sincroniza nos dois sentidos
type: feature
---

# Sync Entregas <-> Tarefas

## Triggers
- sync_deliverable_to_task (em project_deliverables): cria/atualiza/apaga task conforme responsible_type e deliverable_type. Tipos reuniao|link|documento|aprovacao ou is_meeting=true nao geram task.
- sync_task_status_to_deliverable (em tasks): propaga task.status -> deliverable.status.

## Anti-loop (Fase C-3)
Ambos os triggers usam GUC de sessao app.deliv_task_sync ('on'/'off') para impedir re-entrada cruzada.

## Reconciliacao
reconcile_deliverable_tasks(_apply boolean) deteta e corrige 3 tipos de drift:
1. missing_task - entrega de equipa sem task associada
2. orphan_task - task com deliverable_id apontando para entrega inexistente
3. status_drift - entrega concluida sem task done (ou vice-versa)

UI: Definicoes -> Sistema -> "Reconciliacao Entregas <-> Tarefas" (botoes Verificar/Corrigir).
