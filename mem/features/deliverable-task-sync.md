---
name: deliverable-task-sync
description: Entregas de projeto (responsible_type=equipa) auto-geram tarefas ligadas via trigger; conclusão sincroniza nos dois sentidos
type: feature
---
Quando se cria uma `project_deliverable` com `responsible_type='equipa'`, um trigger DB cria automaticamente uma `task` ligada via `tasks.deliverable_id`.

**Sincronização:**
- Renomear/mudar data da entrega → propaga para a tarefa
- Concluir entrega (status concluido/entregue) → marca tarefa concluida
- Concluir tarefa → marca entrega concluida
- Apagar entrega → apaga tarefa

**Heurística do assignee (resolve_deliverable_assignee):**
1. `assigned_to` explícito da entrega
2. Membro do projeto cuja `project_members.role` = `project_deliverables.responsible_role`
3. Único membro do projeto
4. NULL (sem assignee)

**Schema novo:**
- `project_members.role` (text, opcional)
- `product_deliverable_templates.responsible_role` + `project_deliverables.responsible_role`
- `tasks.deliverable_id` (uuid, fk implícito)

**Implicação:** widgets de Operação (Conclusão Semanal, Atrasados, etc) que contam tarefas passam a refletir trabalho real porque entregas viram tarefas. Não duplicar contagem se um dia se mostrar entregas + tarefas no mesmo widget — filtrar por `deliverable_id IS NULL` se quiseres só "tarefas livres".
