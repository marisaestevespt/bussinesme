
## Arquitetura Simplificada: Fases & Entregas

### Fluxo único
**Produto (template)** → **Projeto (instância com status)** → **Portal (visualização automática)**

### 1. Limpeza de legado
- **Eliminar** `portal_timeline_phases` (0 registos, sem uso)
- **Remover** `portal_visible` de `sop_steps` (SOPs são sempre internos)
- **Migrar** conceito de `client_onboarding` → será uma Fase 0 dentro das fases do projeto

### 2. Schema — Adicionar `linked_sop_id` às entregas
- `product_deliverable_templates` ganha `linked_sop_id` (associar SOP interno à entrega template)
- `project_deliverables` ganha `linked_sop_id` (associar SOP interno à entrega do projeto)

### 3. Produto (tab Entregas) — já existe, melhorar
- Definir fases (Fase 1 - Diagnóstico, Fase 2 - Implementação, etc.)
- Dentro de cada fase: entregas/marcos
- Cada fase e entrega pode ter um SOP associado (visível só internamente)
- Fase pode ter `is_onboarding = true` para marcar como Fase 0

### 4. Projeto — propagação automática
- Quando template é aplicado ao projeto, fases + entregas são copiadas
- No projeto: gerir status de cada fase (pendente/em_curso/concluída) e cada entrega (pendente/em_progresso/concluído)
- Mudanças de status refletem no portal automaticamente

### 5. Portal do Cliente
- Timeline mostra fases com status visual (pendente/em curso/concluída)
- Dentro de cada fase: lista de entregas/marcos com status
- Sem SOPs, sem edição — apenas visualização
- Atualizar RPC `get_portal_phases` para incluir entregas

### 6. Código a alterar
- `ProductEntregasSection.tsx` — adicionar SOP linking a entregas (já tem para fases)
- `ProjectPhasesTimeline.tsx` — mostrar entregas dentro das fases
- `ApplyProductTemplate.tsx` — copiar fases + entregas para projeto
- Portal — usar `get_portal_phases` atualizado com entregas
- Remover referências a `portal_timeline_phases`
- Remover `portal_visible` toggle dos SOPs
