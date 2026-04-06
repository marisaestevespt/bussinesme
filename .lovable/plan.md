
## Fases do Produto → Projeto → Portal

### 1. Nova tabela: `product_phases` (template no produto)
- `product_id`, `name` (ex: "Onboarding", "Implementação"), `description`, `sort_order`, `linked_sop_id` (opcional — liga a um SOP)
- Os entregáveis existentes (`product_deliverable_templates`) ganham uma coluna `phase_id` opcional para serem agrupados dentro de uma fase

### 2. Nova tabela: `project_phases` (instância no projeto)
- Cópia das fases do produto quando o template é aplicado ao projeto
- `project_id`, `name`, `description`, `sort_order`, `status` (pendente/em_curso/concluida), `started_at`, `completed_at`, `linked_sop_id`
- Os `project_deliverables` existentes ganham `phase_id` para agrupamento

### 3. UI no Produto (tab Entregas)
- Secção de fases com drag & drop para ordenar
- Cada fase pode ter entregáveis dentro e/ou link a um SOP
- Botão para adicionar fase, editar nome, remover

### 4. UI no Projeto (tab Processos ou nova tab Fases)
- Timeline visual das fases com progresso
- Dentro de cada fase: entregáveis, SOPs linkados, status
- Fase atual destacada

### 5. UI no Portal do Cliente
- Timeline simplificada mostrando as fases e qual é a atual
- Dentro de cada fase: itens que o cliente precisa ver/fazer
- Sem edição, apenas visualização + checkboxes do cliente

### 6. RPC para portal
- `get_portal_phases` — devolve fases e itens do projeto associado ao portal
