---
name: calendar-quick-add-pattern
description: Padrão Notion-like para grids de calendário mensal — botão "+" no canto superior direito de cada célula (visível em hover) para criar item já com data pré-preenchida
type: design
---
# Padrão Quick-add em calendários

Aplicado em: Marketing > ContentCalendar (`src/components/marketing/ContentCalendar.tsx`).

## Regras
1. Toda grelha de calendário mensal (cell por dia) DEVE expor um quick-add por célula no canto superior direito.
2. Botão `<Plus h-3.5 w-3.5>` em `opacity-0 group-hover/day:opacity-100`, `h-5 w-5 rounded-sm`, `text-muted-foreground hover:text-foreground hover:bg-muted`.
3. Cabeçalho da célula é `flex items-center justify-between` (número do dia à esquerda, botão à direita) — NUNCA mover o número do dia.
4. O componente de calendário recebe `onCreateForDate?: (date: Date) => void` opcional. Se não passado, o botão não é renderizado (evita criar entidades em vistas read-only).
5. Handler do parent define hora sensata por defeito (12:00 local) e converte para ISO antes de inserir.

## Why
O utilizador comparou explicitamente com o Notion: "cada dia deve ter um '+' num dos cantos para adicionar logo um post ali". Sem este atalho, criar conteúdo no dia X obriga a clicar "Novo", abrir detalhe, e definir data manualmente — fricção desnecessária.

## How to apply
- Calendários futuros (tarefas, reuniões, eventos): replicar a mesma assinatura `onCreateForDate` + botão hover.
- O parent é responsável por: (a) inserir entidade com `scheduled_at`/`due_date` definidos para o dia clicado, (b) navegar para o detalhe ou abrir um sheet inline.
