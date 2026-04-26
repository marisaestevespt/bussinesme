---
name: time-tracking-analysis
description: Tempo estimado vs real em entregas/tarefas e página de Análise Empresarial na Executive Room
type: feature
---
**Modelo de tempo (previsto vs real):**
- `product_deliverable_templates.estimated_minutes` — owner define no produto
- `project_deliverables.estimated_minutes` — herda do template ao importar; editável via popover na linha (ícone Clock)
- `tasks.estimated_minutes` — copiado da entrega via trigger `sync_deliverable_to_task` (não sobrepõe se já existir manual)
- **Tempo real** = `task_time_entries.duration_minutes` (timer + manual). Não duplicar — sempre derivado.

**Prioridade do estimado em tarefas:**
1. Vem da entrega (se task tem `deliverable_id`)
2. Manual / histórico (lógica existente)

**`projects.budgeted_minutes`** existe na BD mas ainda não é usado (futuro snapshot congelado no arranque do projeto). Hoje a análise calcula on-the-fly somando entregas + tasks standalone com estimado.

**Página "Análise Empresarial":** `/executive/analise-empresarial` (`ExecutiveAnaliseEmpresarial.tsx`)
- Saúde de horas dos projetos ativos (previsto vs real, % desvio)
- Top 5 projetos a estourar (variance > 10%)
- Alerta de capacidade quando 2+ projetos com estouro > 25% (sugere contratar/rever estimativas)
- Espaço reservado para futuras análises (rentabilidade real, eficiência por membro)
- Link no card "Business" do ExecutiveDashboard

**UI do tempo na linha da entrega (ProjectDeliverables.tsx):**
- Badge `Clock real / estimado` clicável → popover para editar estimado
- Cor: success (real ≤ estimado), destructive (real > estimado * 1.1), muted (sem comparação)
