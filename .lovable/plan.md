# Refactor do Planeamento — Cascata única e intuitiva

## Problema atual

Há demasiados pontos de entrada para a mesma coisa:
- `/executive/planeamento` (overview com 3 horizontes + 8 áreas)
- `/executive/planeamento/estrategico` (anual)
- `/executive/planeamento/tatico` (trimestral)
- `/executive/planeamento/operacional` (mensal)
- Dentro do Mensal, o "Cockpit" mostra trimestre + áreas + reflexão — duplica o que está noutros lados
- Estratégico/Tático/Operacional é jargão de consultoria, pouco intuitivo
- Áreas (8) misturadas com horizontes (3) cria matriz confusa
- Objetivos vs Metas vs OKRs vs Diretrizes — nomes a mais

## Nova framework conceptual

**Uma única cascata, com nomes diretos:**

```text
Visão / Diretrizes 3-5 anos       (raiz estratégica, já existe)
        ↓
Objetivos Anuais                  (3-7 por ano, por área)
        ↓
Metas Trimestrais (Rocks)         (desmembram cada objetivo anual)
        ↓
Metas Mensais                     (desmembram cada meta trimestral)
        ↓
OKRs / Foco da Semana             (ações concretas que movem as metas mensais)
```

Cada nível tem **parent_id** para o nível acima → navegação natural drill-down/drill-up.
Cada item tem **área** (comercial, marketing, financeiro, etc.) → filtro lateral, não eixo principal.

## Nova UI — uma única página `/planeamento`

Substitui as 4 páginas atuais. Tabs no topo correspondem aos 4 níveis da cascata:

```text
┌─ Planeamento ─────────────────────────────────────────────┐
│  [ Ano ] [ Trimestre ] [ Mês ] [ Semana ]      Área: ▾    │
├───────────────────────────────────────────────────────────┤
│  Header contextual: "2026 · Q2 · Maio · Semana 21"        │
│  Breadcrumb cascata: Anual → Trimestral → Mensal → Semana │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  Tab ativa renderiza só os itens do nível,                │
│  agrupados por área, com:                                  │
│   - Progresso (semáforo)                                   │
│   - Link "ver pais" e "ver filhos"                         │
│   - Botão "desmembrar em filhos"                           │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

**Princípios:**
- 1 página, 4 tabs (nível), 1 filtro de área. Sem matriz.
- Cada item mostra de onde vem (pai) e o que gera (filhos) sem mudar de página.
- Reflexão mensal/trimestral fica dentro da tab respetiva, não numa página separada.

## Mapeamento das páginas atuais

| Atual                                | Novo                                  |
|--------------------------------------|---------------------------------------|
| /executive/planeamento (overview)    | redireciona para /planeamento         |
| /executive/planeamento/estrategico   | tab "Ano"                             |
| /executive/planeamento/tatico        | tab "Trimestre"                       |
| /executive/planeamento/operacional   | tab "Mês"                             |
| Weekly Align (kpis/rituais)          | mantém-se à parte (é ritual semanal)  |
| Foco da Semana (OKRs)                | tab "Semana" do novo /planeamento     |

Páginas de departamento (`/planeamento/dep/:dep`) mantêm-se — passam a aplicar o filtro de área automaticamente sobre a mesma cascata.

## Dados (sem migração destrutiva)

Tabela `planning_items` já existente cobre os 4 níveis via coluna `period` (`ano`, `trimestre`, `mes`, `semana`). Adicionar/garantir:
- `parent_id uuid` (FK self) — se ainda não existir
- `area text` — já existe
- índices em `(year, period, area)` e `parent_id`

Migração ligeira só se faltar `parent_id`. Sem perder dados existentes.

## Fases de implementação

1. **Migração leve** — garantir `parent_id` + índices em `planning_items` (skip se já existe)
2. **Hook unificado** `usePlanningCascade(year)` — devolve itens por nível com relações pai/filho
3. **Página nova** `src/pages/Planeamento.tsx` com as 4 tabs + filtro de área
4. **Componentes** `CascadeLevel.tsx` (lista por nível) + `CascadeItemCard.tsx` (com pai/filhos)
5. **Redirects** das 4 rotas antigas para `/planeamento?nivel=…`
6. **Limpeza** — marcar páginas antigas como deprecated, remover do menu

## Riscos

- Páginas antigas têm UI rica (Cockpit mensal com 8 blocos). Não perder funcionalidade — os blocos viram conteúdo da tab "Mês" mas agrupados por área única em vez de 8 secções fixas.
- Weekly Align não se mexe — é ritual, não planeamento.
- Permissões: a página unificada herda as mesmas regras de Owner-only que o Executive Room.

## Confirmar antes de avançar

1. Concordas com os 4 níveis: **Ano / Trimestre / Mês / Semana**? Ou queres outro nome (ex.: "Anual / Trimestral / Mensal / Foco")?
2. OK manter o Cockpit mensal atual (8 blocos por área) **dentro** da tab "Mês", ou queres versão mais enxuta?
3. Avanço com a fase 1 (migração leve + nova página) assim que aprovares?
