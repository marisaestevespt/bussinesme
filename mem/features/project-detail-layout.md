---
name: Project detail tab layout
description: ProjetoDetail.tsx — abas, ordem de secções por tipo, reuniões, health badge, título
type: feature
---

## Abas
1. **Overview de Projeto** (`projeto`)
2. **Fluxo de Trabalho** (`processos`) — antiga "Tarefas & Responsabilidades"
3. **Portal de Cliente** (se cliente associado)
4. **Gestão** (se não-interno) — admin: pagamentos, contrato, vendas. **Sem reuniões.**
5. **Encerramento da Avença / Fecho de Projeto**

## Tab Fluxo de Trabalho — ordem das secções
- **Avença mensal** (`isServicoMensal`): Responsabilidades → Rotinas → Tarefas → Reuniões. **Sem SOPs.**
- **Outros projetos** (pontual, deadline-driven, tarefas livres, futuros): Tarefas → SOPs/Processos → Reuniões.

## Reuniões
- Listadas dentro da tab Fluxo de Trabalho (no fim): próximas + últimas 3 realizadas, com botão "Ver todas" que abre a sub-página completa.
- Card "Próxima Reunião" em destaque no topo da Overview (só aparece se houver reunião futura).
- Botão "+ Reunião" vive na secção Reuniões da tab Fluxo de Trabalho (não mais ao lado do botão "Tarefa").

## Botões de ação na secção Tarefas
- Sempre: "+ Tarefa"
- Só `tarefas_fixas`: "📋 Gerar"

## Health badge
- `src/lib/projectHealth.ts` (partilhado com Operação dashboard).
- Overdue-only para avenças/tarefas_livres; deadline-driven para os outros.
- Renderizado no header do detalhe ao lado dos badges Interno/Avença.

## Título do projeto
- Input editável em linha própria (block w-full), `text-3xl md:text-2xl font-bold`.
- Badges (Interno, Avença, Health) numa linha por baixo do título.
