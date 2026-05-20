# Refactor do Planeamento (anual / trimestral / mensal)

## Conceito unificado

```
Departamento ──tem──► KPIs permanentes (medição contínua: produtividade, sucesso)
                          ▲
                          │ pode ser referenciado como
                          │
Objetivo Anual ──tem──► Key Results (3-5, mensuráveis, com target anual)
                          │
                          ├─► distribui target por Q1/Q2/Q3/Q4 (metas trimestrais)
                          ├─► distribui target por mês (metas mensais)
                          └─► pode gerar foco semanal (Weekly Align)
```

- **KPI** = métrica permanente do departamento (ex.: NPS, tempo médio de resposta, taxa de ocupação). Vive em /equipa ou /planeamento → Departamentos.
- **KR** = resultado mensurável com prazo, dentro de um objetivo. Pode "puxar" um KPI existente (auto-tracking) ou ser standalone.
- **Meta trimestral/mensal** = fatia do target do KR nesse período.

## Schema (migration)

1. **`department_kpis`** (novo)
   - `department` (text), `name`, `description`, `unit`, `target`, `value_source` (manual | tabela existente), `source_filter` (jsonb), `is_active`
2. **`objective_key_results`** (novo) — promoção do conceito atual de "criteria + metric"
   - `objective_id` FK, `title`, `target_value`, `current_value`, `unit`, `value_source`, `source_filter`, `linked_kpi_id` FK opcional, `sort_order`
3. **`key_result_periods`** (novo) — target dividido por período
   - `key_result_id`, `period_type` ('trimestre' | 'mes' | 'semana'), `period_key` (ex.: '2026-Q1', '2026-03', '2026-W12'), `target`, `actual`
4. Manter `objective_metrics`/`objective_criteria` por compatibilidade, marcar deprecated em código.

## UI — Tab Anual

- Cards de objetivo passam a mostrar, abaixo do título:
  - **Valor atual / target** (ex.: `€42k / €120k`) com unidade
  - Lista compacta dos KRs (até 3 visíveis, "+N" se mais)
  - Progresso por KR em mini-barras
- Drawer continua a abrir detalhe completo + edição inline.

## UI — Tab Trimestral

- Remove a grelha por área atual.
- **Lista vertical**, um bloco por objetivo anual:
  ```
  ▸ Objetivo: Triplicar receita recorrente          [Q2 2026]
    ├─ KR1  MRR > €15k          [████████░░] €12k/€15k
    ├─ KR2  Churn < 4%          [██████░░░░]   5.2%/4%
    └─ KR3  10 novos clientes   [█████████░]      9/10
    [+ Nova meta trimestral]   [Editar]   [Notas]
  ```
- KRs do trimestre vêm de `key_result_periods` (period_type='trimestre').
- Header do trimestre: stats agregadas + seletor Q1-Q4.

## UI — Tab Mensal

- Mantém-se como cockpit mas:
  - **Cada secção por área é editável in-place** (não só leitura). Inputs para target/actual, link directo para tarefas/reuniões dessa área.
  - O drawer não fecha o cockpit — abre lateralmente (sheet), sem perder o scroll do mês.
  - Cards redesenhados: hierarquia clara (valor grande, label pequeno, sparkline quando faz sentido).
- Corrigir métricas partidas:
  - **Capacidade equipa** — usar `teamMonthlyCapacitySummary` (lib já existe), filtrar entries do mês correcto
  - **Horas por cliente** — agregação de `time_entries` por client_id no mês
  - **Entregas no mês** — `deliverables` com due_date no mês + status
- Adicionar bloco **Key Results do mês** no topo (vindos de `key_result_periods` period_type='mes').

## UI — Departamentos (novo separador)

- Nova subpágina `/planeamento/dep/:dep` (a página já existe, vamos enriquecer):
  - Bloco **KPIs do departamento** no topo: lista editável, valor actual, target, tendência.
  - Bloco **Objetivos com KRs ligados a este departamento** (via `linked_kpi_id`).

## Implementação (passos)

1. **Migration** — criar 3 tabelas (`department_kpis`, `objective_key_results`, `key_result_periods`) com RLS (mesmas regras de leitura/escrita de `executive_objectives`).
2. **Hook `usePlanningData`** — adicionar leitura/mutações para KRs e period targets; manter API de objetivos compatível.
3. **Hook `useDepartmentKpis`** — novo, para CRUD de KPIs por departamento.
4. **Anual** — atualizar `PlanningObjectivesTab` card para mostrar valor/target/KRs inline (modo `showKRsInline`).
5. **Trimestral** — substituir grelha de áreas por `<QuarterObjectiveList />` nova; mantém botão "Nova meta trimestral" mas agora cria KR-period.
6. **Mensal** — redesign `MonthlyCockpit`:
   - Substituir Cards por secções editáveis (`<EditableAreaSection />`)
   - Usar `<Sheet />` lateral em vez de drawer cheio para detalhe
   - Adicionar bloco "KRs do mês"
   - Reparar `BlockOperacao` (capacidade + horas por cliente) e `BlockProjetos` (entregas)
7. **Departamento** — adicionar tab "KPIs" em `PlaneamentoDepartamento.tsx`.
8. **Migrar dados existentes** (best-effort): `objective_metrics` → `objective_key_results` (trigger one-shot via SQL na migration).

## Fora deste plano (para depois)

- Fundir Mensal com Weekly Align (decidiste manter separado, só redesign).
- Visão 5 anos (já está OK).
- Cron de auto-status (continua a funcionar nos novos KRs).

## O que vais ver no fim

- Cards anuais com números reais, não só %.
- Trimestre como lista clara objetivo→KRs com progresso por trimestre.
- Mês com secções editáveis por área (não cards estáticos), drawer lateral, métricas a funcionar.
- KPIs vivem em cada departamento; OKRs (com KRs) vivem em cada objetivo; KRs podem puxar KPIs.

Confirma se avanço — vou começar pela migration.