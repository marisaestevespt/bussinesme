---
name: Product project configuration
description: Products define default_project_mode (pontual/recorrente) and task_mode (fases/tarefas_fixas/tarefas_livres) that auto-fill when creating projects
type: feature
---
## Product → Project Configuration

Two fields on `products` table:
- `default_project_mode`: `pontual` | `recorrente`
- `task_mode`: `fases` | `tarefas_fixas` | `tarefas_livres`

Also added `task_mode` to `projects` table (inherited from product).

### Task Mode meanings:
- **fases**: Progress tracked by phases/deliverables (e.g., Consultoria de Implementação)
- **tarefas_fixas**: Same tasks repeat monthly (e.g., Gestão de Redes Sociais)
- **tarefas_livres**: Tasks created ad hoc as needed (e.g., Assistente Virtual)

### Auto-fill flows:
1. **Project creation dialog** (`Projetos.tsx`): Product selector → auto-fills `project_mode` and `type`
2. **Lead conversion** (`LeadDetailSheet.tsx`): Reads `default_project_mode` and `task_mode` from product
3. **Product detail** (`ProdutoDetail.tsx`): Config section with both selectors above commercial details
