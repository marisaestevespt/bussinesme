---
name: Project detail tab layout
description: ProjetoDetail.tsx — ordem da tab "Tarefas & Responsabilidades" por tipo, botões de ação, health badge
type: feature
---

## Tab "Tarefas & Responsabilidades" (value="processos")

### Avença mensal (isServicoMensal)
Ordem: Responsabilidades Acordadas → Rotinas/Tarefas Fixas → Tarefas. **Sem SOPs/Processos.**

### Outros projetos (pontual, deadline-driven, tarefas livres, futuros)
Ordem: Tarefas → SOPs/Processos (`ProjectProcessosTab`). Sem Responsabilidades nem Rotinas.

## Botões de ação na secção Tarefas
- Sempre: "+ Tarefa"
- Só `tarefas_fixas`: "📋 Gerar"
- **Não tem botão "+ Reunião"** — reuniões criam-se na tab Gestão ou no módulo Reuniões (onde são listadas).

## Health badge
- Calculado em `src/lib/projectHealth.ts` (partilhado com Operação dashboard).
- Regras diferentes consoante modo: overdue-only para avenças/tarefas_livres; deadline-driven para os outros.
- Mostrado no header do detalhe do projeto, ao lado dos badges Interno/Avença.

## Título do projeto
- Input editável em linha própria (block w-full), `text-3xl md:text-2xl font-bold`.
- Badges (Interno, Avença, Health) numa linha por baixo do título — não no mesmo flex-wrap, para não roubar área de clique.
