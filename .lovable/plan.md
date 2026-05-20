# Plano — Frentes C + D + E (Planeamento)

Continuação direta de A + B. O objetivo é fechar o ciclo: KPRs ↔ Objetivos, cadências múltiplas, e presença consistente em todas as vistas.

---

## C. Ligação KPR ↔ Objetivo (single source of truth)

**Migração DB**
- `ALTER TABLE department_kpis ADD COLUMN objective_id uuid NULL REFERENCES executive_objectives(id) ON DELETE SET NULL`
- Index em `objective_id`.
- Trigger `kpr_sync_to_planning_goals`: quando um KPR ligado a um objetivo tem `department_kpi_monthly` atualizado, faz upsert no `planning_goals` correspondente (period_type='mensal', period=`YYYY-MM`) com `target_value` / `actual_value`. Anti-loop via GUC `app.kpr_sync` (padrão já existente no projeto — ver memory `sync-anti-loop`).
- Trigger inverso opcional: se um `planning_goals` mensal ligado a um objetivo que tem KPR vinculado é editado, propaga ao `department_kpi_monthly`.

**UI**
- Em `KpiForm` (DepartmentKpiDashboard + DepartmentKpisSection): novo `Select` "Objetivo anual associado" filtrado por `area === department`.
- Badge em listagens de KPRs mostrando "ligado a: <objetivo>".
- Em `ObjectiveDialog` (Planeamento anual): listar KPRs ligados ao objetivo (read-only com link para Dept).

## D. Cadências múltiplas (mensal + trimestral + anual)

**Migração DB**
- `ALTER TABLE department_kpis ADD COLUMN quarterly_target numeric NULL, ADD COLUMN annual_target numeric NULL`.
- `quarterly_target` é interpretado por quarter (igual em todos) — para metas distintas por trimestre criamos `department_kpi_quarterly (kpi_id, year, quarter, target_value, actual_value, analysis)` com unique `(kpi_id, year, quarter)` e RLS igual a `department_kpi_monthly`.
- View materializada leve `v_department_kpi_progress` que agrega mensal→trimestre→ano para consumo no front.

**UI**
- `KpiForm` ganha 3 campos: Meta Mensal (default), Meta Trimestral, Meta Anual.
- Em `KPRsInline` (cockpit mensal) adicionamos toggle "Mensal | Trimestral | Anual" no header do bloco de KPRs, alternando a meta e o `actual` agregado.
- `useKpiAutoValue` ganha parâmetro `period: 'month' | 'quarter' | 'year'` e usa o mesmo `value_source` mas com janelas diferentes (mês corrente, Q corrente, ano corrente).

## E. KPRs em todas as vistas

**Weekly Align**
- Após a lista de objetivos atuais, nova secção "KPRs em foco" com os KPRs do departamento(s) do utilizador. Cada linha: nome, meta mensal, atual auto, Δ%, mini-input de nota semanal (campo já existente `notes` em planning ou criar `department_kpi_weekly_notes` se necessário). Por agora, reusar `analysis` do mês corrente.

**Cockpit Trimestral** (`QuarterlyCockpit`)
- Reusar `KPRsInline` em modo `period='quarter'` dentro de cada bloco de área.

**Cockpit Anual**
- Resumo agregado (sem edição), apenas leitura: nome | meta anual | atual anual | Δ%, agrupado por área.

**Hubs operacionais** (Comercial, Marketing, Financeiro, Clientes, Operação, Equipa, Produtos)
- Adicionar componente `<DepartmentKpiSummary department="..." />` no topo de cada hub: chips horizontais com meta vs atual do mês, link "Ver detalhe →" para `/executive/planeamento/[dept]`.

---

## Ficheiros estimados

**Migrations** (1 ficheiro):
- `add_kpr_objective_link_and_cadences.sql` — coluna `objective_id`, `quarterly_target`, `annual_target`, tabela `department_kpi_quarterly`, triggers de sync.

**Edits**:
- `src/hooks/useKpiAutoValue.ts` — suportar `period`
- `src/components/planning/DepartmentKpiDashboard.tsx` — UI objetivo + cadências
- `src/components/planning/DepartmentKpisSection.tsx` — idem
- `src/components/planning/cockpit/KPRsInline.tsx` — toggle período
- `src/components/planning/cockpit/QuarterlyCockpit.tsx` — incluir KPRs
- `src/components/planning/cockpit/AnnualCockpit.tsx` — resumo anual KPRs
- `src/components/planning/WeeklyAlign*.tsx` — secção KPRs em foco
- `src/components/planning/ObjectiveDialog.tsx` — listar KPRs vinculados

**Novos**:
- `src/components/planning/DepartmentKpiSummary.tsx` — chips para hubs
- Inserção do summary em 7 hubs operacionais

---

## Ordem de execução

1. Migração DB (C + D estruturais)
2. Atualizar `useKpiAutoValue` para suportar `period`
3. UI dos formulários (objetivo + cadências)
4. `KPRsInline` com toggle de período
5. Quarterly + Annual cockpits
6. Weekly Align
7. Hubs operacionais (DepartmentKpiSummary)
8. Memory: atualizar `mem://features/planning-overview` com novo modelo

Cada passo é validado antes de avançar (queries DB + verificação visual no preview).
