## Objetivo

Resolver dívida técnica no sistema de planeamento sem adicionar funcionalidades. Consolidar fontes de verdade, remover duplicação e formalizar accountability.

## Ordem de execução (segura → arriscada)

### Passo 1 — Normalizar `planning_goals.period` (base de dados)

Migration que converte valores legacy para o formato canónico:
- Trimestre: `T1..T4` → `Q1..Q4`
- Mês: `Janeiro..Dezembro` → `YYYY-MM` (usar `year` da row para o YYYY)
- Adicionar check soft (validação por trigger, não CHECK constraint, para permitir formatos `Q[1-4]`, `S[1-2]`, `YYYY`, `YYYY-MM`)

Atualizar hooks que filtram/escrevem `period`:
- `usePlanningData.tsx` (linha ~265, gerar `period` no novo formato em vez de "Janeiro")
- `MonthlyCockpit` blocks que leem por mês
- `AreaPeriodDetail`, `MarketingAnalise`, `FinGoals`

### Passo 2 — Adicionar `owner_id` a `executive_objectives`

Migration aditiva:
```sql
ALTER TABLE executive_objectives
  ADD COLUMN owner_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
```
UI:
- `ObjectiveDetailSheet`: dropdown "Responsável" (lista `team_members`)
- `ObjectiveCascadeRow` / cockpit / Weekly Align: avatar do responsável (fallback CEO se null)

### Passo 3 — Sincronização Marketing/Financeiro ↔ Planning

Em vez de edge functions, usar **triggers PL/pgSQL bidirecionais** (mais simples, atómicos):
- `sync_planning_to_marketing()`: AFTER INSERT/UPDATE em `planning_goals` WHERE area='marketing' → upsert em `marketing_goals`
- `sync_marketing_to_planning()`: AFTER INSERT/UPDATE em `marketing_goals` → upsert em `planning_goals` area='marketing'
- Guard `pg_trigger_depth() = 1` para evitar loops
- Idem para financeiro

### Passo 4 — Consolidar `PlaneamentoDepartamento`

Refactor `src/pages/PlaneamentoDepartamento.tsx`:
- Apagar markup duplicado
- Compor componentes existentes do Executive Tatico filtrados por `area = dept`:
  - `ObjectiveCascadeRow` (read-only, sem botões de edit)
  - Lista `planning_goals` da área (mensais + trimestrais)
  - Lista `objective_actions` da área
- Novo campo editável `notes` em `planning_goals` (membro da área pode editar)
- Migration: `ALTER TABLE planning_goals ADD COLUMN notes text;` + RLS update

### Passo 5 — Departamentos vazios

`/planeamento/dep/{operacao,clientes,produtos,equipa}`: passam a usar o mesmo componente refatorado do passo 4. Estado vazio com CTA → `/executive/planeamento/tatico`.

### Passo 6 — Weekly Align ligado ao planeamento

`WeeklyAlignSections.tsx` secção "Metas":
- Inline: lista `planning_goals` do mês corrente com progresso e semáforo
- Botão "Marcar em risco" por meta → atualiza `status='em_risco'` + abre textarea para `deviation_decision`
- Campo `deviation_decision` editável também no `MonthlyCockpit` BlockObjetivos quando status ∈ {em_risco, nao_atingido}

### Passo 7 — Limpar redirects legacy

`rg` para cada rota antiga, atualizar links internos para a rota nova. Manter o `<Route>` de redirect em `App.tsx` com comentário:
```tsx
{/* Legacy redirect — manter para bookmarks externos. Não usar em novos links. */}
```

### Passo 8 — Remover `executive_goals`

1. `rg "executive_goals"` confirma só referências em migrations + types + edge functions de backup/reset (que iteram tabelas dinamicamente — OK)
2. Migration: `DROP TABLE IF EXISTS public.executive_goals CASCADE;`
3. types.ts regenera-se sozinho

## Notas de risco

- Triggers bidirecionais: testar com um INSERT manual depois de aplicar
- Normalização de `period`: rodar dentro de uma transaction, manter coluna `period_type` populada para retrocompat até nova UI estabilizar
- `PlaneamentoDepartamento`: garantir que membros sem permissão ainda veem (RLS já cobre via `has_role`)

## Entregáveis

- ~5 migrations (period, owner_id, sync triggers, notes, drop executive_goals)
- Refactor de `PlaneamentoDepartamento.tsx` (167 → ~60 linhas)
- Updates em `WeeklyAlignSections`, `MonthlyCockpit`, `ObjectiveDetailSheet`, `usePlanningData`
- Memory update referenciando nova source-of-truth única (`planning_goals`)

Pretendes que avance com tudo de uma vez, ou preferes que pare a meio (ex.: depois do passo 3) para validares antes de continuar?