# Redesenhar /executive/planeamento

## Objetivo
Tirar a "Cascata Estratégico → Tático → Operacional" como protagonista da página e substituir por uma estrutura **por horizonte temporal** com **dashboard de progresso** e edição em **painel lateral**. A parte estratégica (Identidade, SWOT, Diretrizes 3-5 anos) **fica no topo, colapsada** por defeito.

## O que muda visualmente

```text
/executive/planeamento  (ano em destaque)
├── 🧭 Estratégia (3-5 anos)       ← acordeão fechado por defeito
│     Identidade · SWOT · Diretrizes (já existente, embebido)
│
├── 📊 Pulse do ano                 ← cards de KPI no topo (mantém)
│     Objetivos · Progresso médio · Metas atingidas · Cobertura · Desvios
│
├── 🗓️ Horizontes do ano            ← NOVO — substitui a cascata
│     ┌─────────┬─────────┬─────────┬─────────┐
│     │   T1    │   T2    │   T3    │   T4    │  cards trimestrais com %
│     └─────────┴─────────┴─────────┴─────────┘
│     Cada T abre uma faixa com 3 mini-cards (meses) — % e nº de metas
│
├── 🎯 Objetivos anuais             ← NOVO — lista visível, editável
│     Tabela/cards com: título, área, progresso, status, próximo marco
│     Botão "+ Novo objetivo" → abre Sheet
│     Clicar num objetivo → abre Sheet de detalhe (já existe)
│
└── 🧩 Cobertura por área           ← mantém (já bom)
      Grid 8 áreas com % e alertas
```

## Mudanças por ficheiro

### `src/components/planning/PlanningOverviewView.tsx` (refazer)
- **Remover** o bloco "Cascata de Planeamento" com 3 botões coloridos (Estratégico/Tático/Operacional).
- **Adicionar** novo bloco `HorizonsView`:
  - 4 cards trimestrais (T1–T4) com % média de progresso das metas desse trimestre, nº de metas e estado (em curso / atingido / atrasado).
  - Cada T expansível para mostrar os 3 meses → cada mês com link para `/executive/planeamento/operacional?ano=Y&mes=M`.
- **Manter** o bloco "Cobertura por Área" tal como está.

### `src/components/planning/AnnualObjectivesBoard.tsx` (NOVO)
- Lista todos os objetivos do ano em cards/linhas com inline progress bar.
- Botão "+ Novo objetivo" abre `ObjectiveDetailSheet` em modo create.
- Clicar abre o `ObjectiveDetailSheet` existente em modo edit.
- Filtros simples: por área, por status.

### `src/pages/ExecutivePlaneamento.tsx`
- Acima do Pulse, **novo** acordeão "Estratégia (3-5 anos)" — `<Collapsible defaultOpen={false}>` que embebe `<StrategicSection />`.
- Manter Pulse cards.
- Substituir o conteúdo abaixo: `HorizonsView` → `AnnualObjectivesBoard` → `AreaCoverage`.
- Manter os links discretos para `/executive/planeamento/estrategico|tatico|operacional` (passam a ser "Ver detalhe" no canto de cada secção, em vez de protagonistas).

### `src/components/planning/ObjectiveDetailSheet.tsx`
- Já existe e usa Sheet. Garantir que abre com `id=null` para criar (verificar e expor um modo "novo").

## Dados (sem migração)
- Tudo já está em `usePlanningData(year)`: `allObjectives`, `allGoals`, `objectiveProgress`.
- Trimestres derivam-se filtrando `goals` por `period ∈ {Q1..Q4, T1..T4}` ou pelos meses Jan-Mar/Abr-Jun/etc.
- Sem alterações de schema.

## Detalhes técnicos
- Acordeão estratégico: `<Collapsible>` do shadcn, fechado por defeito; chevron + label "Estratégia 3-5 anos · clica para abrir".
- Cards trimestrais: grid `lg:grid-cols-4`, cada card com header (T1 · Jan-Mar), `<Progress>` e badge de status. Click expande inline (não navega).
- `AnnualObjectivesBoard`: usa `<Card>` com tabela de cards verticais (não tabela HTML densa) — alinhado com estética matte ceramic.
- Sheet de edição: reutiliza o `ObjectiveDetailSheet` já existente (sem novo componente).
- Sem mudanças nas sub-páginas `/estrategico`, `/tatico`, `/operacional` — passam a ser navegação secundária acessível por links discretos.

## Fora de scope
- Não mexer nas sub-páginas estratégico/tático/operacional (continuam acessíveis).
- Sem mudanças de DB.
- Sem mudanças no `usePlanningData`.
