# Planeamento unificado (2026-05-20)

Substituiu as 3 páginas antigas (`/executive/planeamento`, `/estrategico`, `/tatico`, `/operacional`) por uma única página em `/planeamento` com 5 tabs sincronizadas via `?nivel=visao|ano|trimestre|mes|semana`.

## Cascata conceptual
Visão (3-5 anos) → Ano (objetivos) → Trimestre (rocks) → Mês (cockpit) → Semana (foco/OKRs)

## Implementação
- `src/pages/Planeamento.tsx` — wrapper com Tabs + breadcrumb da cascata + year switcher
- Cada tab reusa componentes existentes:
  - Visão: BusinessPlanCanvas + StrategicSection + Visao5AnosBlock
  - Ano: PlanningObjectivesTab (gallery) + HorizonsView + stats
  - Trimestre: QuarterlyGallery + strip de progresso T1-T4
  - Mês: MonthlyCockpit + strip de 12 meses
  - Semana: WeekFocus (precisa `derived` do useCeoCockpit)
- Rotas antigas (`/executive/planeamento*`) viram `<Navigate>` para o nivel correspondente — bookmarks/links externos continuam a funcionar
- Entry points atualizados: StrategyShortcuts, useItemActions, FavoriteButton, useRitualBanner, routeTitles

## Dados (sem mudança)
Continua a usar `executive_objectives` (anuais com area) + `planning_goals` (period_type='trimestral'|'mensal'). Não há `parent_id` ainda — a "ligação" entre níveis é feita visualmente via componentes existentes.
