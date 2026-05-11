
# Cockpit Mensal do CEO

Reestruturar `/executive/planeamento/operacional` quando há `?mes=` (ou por defeito mês atual) para uma vista única "planear + acompanhar" com 8 blocos. A galeria mensal/trimestral atuais passam a ser secundárias (acessíveis num toggle "Ver galeria do ano" ou só visíveis quando não há `?mes=`).

## Estrutura

Nova página/componente principal `MonthlyCockpit` montado no topo quando há mês selecionado. Recebe `year` + `month`.

```
┌─ Header ──────────────────────────────────────────────┐
│ ◀  Maio 2026   [estado]            [Fechar mês]      │
├───────────────────────────────────────────────────────┤
│ B1  Objetivos do Mês       (8 área cards)            │
│ B2  Agenda do Mês          (calendário compacto)     │
│ B3  Comercial              (3 sub-blocos)            │
│ B4  Marketing              (3 sub-blocos)            │
│ B5  Clientes               (3 sub-blocos)            │
│ B6  Operação               (4 sub-blocos)            │
│ B7  Produtos               (lista compacta)          │
│ B8  Reflexão & Fecho       (gated por data)          │
└───────────────────────────────────────────────────────┘
```

Cada bloco é `<CockpitSection collapsible storageKey="cockpit:{key}">` com persistência em `localStorage` (`cockpit-collapsed:{userId}:{blockKey}`).

## Header

- Setas ◀ ▶ navegam mês/ano (preservam `?ano=&mes=`).
- Estado do mês:
  - Futuro → "Planeamento futuro"
  - Atual e não revisto → "Em curso"
  - Atual nos primeiros 3 dias → "A planear"
  - Passado e revisto → "Revisto"
  - Passado e não revisto → "Por rever"
- Botão "Fechar mês" só visível nos últimos 3 dias do mês ou primeiros 3 dias do mês seguinte, e ainda não revisto. Faz scroll para B8.

## Blocos — fontes de dados

**B1 Objetivos do Mês** — `planning_goals` filtrado por `year/month/period_type='mensal'` para as 8 áreas. Reaproveita `goalAutoValue` (já existe em `usePlanningData`). Card sem meta → CTA "Definir meta" abre `ObjectiveDetailSheet` ou modal direto em `planning_goals` insert. Semáforo: ≥90% verde, 60–90% amarelo, <60% vermelho.

**B2 Agenda do Mês** — calendário compacto (grid 7 cols). Eventos de `events`, `meetings`, feriados PT (já existe `useHolidays` ou tabela `holidays`), `team_off_days`. Click → `Sheet` com lista do dia.

**B3 Comercial** —
- a) Soma `commercial_payments` (status pago) do mês vs `executive_objectives` area=comercial OR `planning_goals` area=comercial mensal.
- b) Leads agrupados por stage (filtrar stages "ativas/proposta/negociação"); follow-ups com `next_followup` no mês.
- c) `commercial_sales_actions` com `start_date` ou `due_date` no mês.

**B4 Marketing** —
- a) `marketing_goals` para o mês (já com sync do Executive).
- b) `marketing_content` agrupado por status e por canal.
- c) `commercial_sales_actions` filtrado tipo marketing (se campo existir; senão só comercial).

**B5 Clientes** —
- a) Contagens de `clients` por status (ativo/onboarding/offboarding) + média de progresso de `client_onboarding_checklists`.
- b) `clients` com `end_of_cycle` no mês.
- c) `nps_records` agendados para o mês.

**B6 Operação** —
- a) `projects` com atividade no mês (deadline ou tasks com due no mês).
- b) `member_capacity` vs `time_entries` agregados por membro/mês.
- c) `routines` mensais/semanais → contar `routine_occurrences` do mês concluídas/total.
- d) `tasks` com `priority IN ('P1','P2')` e `due_date` no mês.

**B7 Produtos** — `products` ativos: contagem clientes (`client_products` ou similar), NPS médio 90d, `product_deliverables` em atraso. Em desenvolvimento: lista nome/estado/próximo marco.

**B8 Reflexão e Fecho** — Reaproveitar `MonthlyReflectionCard` existente. Adicionar gate: colapsado e bloqueado fora da janela (último dia + 3 primeiros do mês seguinte). Toggle "revisto" já existe; quando true, header mostra "Revisto" e desbloqueia banner do mês seguinte.

## Componentes a criar

```
src/components/planning/cockpit/
├── MonthlyCockpit.tsx            (orquestrador + header + setas)
├── CockpitSection.tsx            (wrapper colapsável + persist)
├── BlockObjetivos.tsx            (B1)
├── BlockAgenda.tsx               (B2)
├── BlockComercial.tsx            (B3)
├── BlockMarketing.tsx            (B4)
├── BlockClientes.tsx             (B5)
├── BlockOperacao.tsx             (B6)
├── BlockProdutos.tsx             (B7)
└── useMonthState.ts              (calcula estado do mês + janela de fecho)
```

`MonthlyReflectionCard` já existe → reutilizar em B8 com prop `windowOnly`.

## Página `ExecutivePlaneamentoOperacional.tsx`

- Quando há mês selecionado (default = mês atual): renderizar `MonthlyCockpit` no topo.
- Galeria trimestral + galeria mensal passam para baixo num `<details>` "Ver vista anual completa" (preserva o que já existe sem partir nada).

## Modos passado/futuro

- Mês futuro: blocos B2-B7 mostram dados zero/vazios com label "Planeamento futuro" no header da secção; B1 e B8 ativos (B1 para definir metas; B8 colapsado).
- Mês passado: B8 read-only (já suportado pelo card); botão "Fechar mês" oculto se já revisto.

## Out of scope

- Reorder dos blocos (fixo nesta iteração).
- Edição inline avançada além de CTAs para abrir sheets/modais existentes.
- Mexer no schema (todas as tabelas já existem).

Confirma para começar pela infraestrutura (MonthlyCockpit + CockpitSection + header) e depois B1-B8 sequencialmente.
