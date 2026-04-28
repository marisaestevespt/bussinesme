---
name: Batching focus blocks
description: Batching como MODO de produção em O Meu Dia, não secção fixa
type: feature
---
Em `SecretariaDia.tsx` há toggle "Modo Foco (Batching)" no topo. Quando ativo, esconde RoutineMonthCard/KPIs/MyTasksTable e renderiza `SecretariaBatches`. Cada batch tem:
- "Agendar" → cria bloco na agenda via querystring
- "Iniciar sessão" → abre `FocusSessionDialog` fullscreen, mostra UMA tarefa de cada vez (nome + prio + deadline + estimativa) com Concluir/Saltar/Sair e progress bar.
- "Expandir tudo deste contexto" → tabelas com tarefas/reuniões/entregas relacionadas.

Componente único: `src/components/secretaria/SecretariaBatches.tsx` (inclui FocusSessionDialog).
