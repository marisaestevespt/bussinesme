## Objetivo

1. **Eliminar** o bloco separado "KPRs por área" do cockpit mensal.
2. **Inserir uma sub-secção "KPRs" dentro de cada bloco de área** — Comercial+Produtos, Marketing, Clientes, Operação — e **criar os blocos em falta** (Financeiro, Equipa, Geral) para que todas as 8 áreas tenham casa.
3. **Valor atual automático**: cada KPR resolve o `actual_value` a partir do `value_source` configurado na ficha (faturação, leads, clientes ativos, horas, tarefas, etc.), filtrado ao mês. Edição manual só onde `value_source = 'manual'`.
4. **Meta**: continua editável inline, mas reforçamos que pode também ser definida no dashboard do dept ou no Planeamento anual/trimestral (já existe; nenhuma migração necessária agora).

## Mudanças

### Cockpit mensal — estrutura
- `MonthlyCockpit.tsx`: remover `<CockpitSection>` do `BlockKPRs`. Renomear "Comercial e Produtos" para apenas "Comercial" e adicionar bloco **Produtos** separado. Adicionar blocos **Financeiro**, **Equipa**, **Geral**. Ordem final: Objetivos → Comercial → Produtos → Marketing → Clientes → Operação → Financeiro → Equipa → Geral → Agenda → Reflexão.

### Novos blocks (mínimos, só com KPRs por enquanto)
- `BlockFinanceiro.tsx`, `BlockEquipa.tsx`, `BlockGeral.tsx`, `BlockProdutos.tsx`: cada um renderiza apenas `<KPRsInline area="..." />` por agora (placeholders para conteúdos futuros como faturação detalhada, capacidade, etc.).

### Componente partilhado `KPRsInline`
- `src/components/planning/cockpit/KPRsInline.tsx`: recebe `area`, `year`, `month`.
- Lista KPRs do departamento (`useDepartmentKpis(area)`).
- Para cada KPR: mostra **Meta** (editável), **Valor** (auto ou input se manual), **Δ%**, **Análise** (auto + override manual).
- Cabeçalho compacto "Indicadores · X KPRs" + chevron se quisermos colapsar.

### Resolver automático mensal
- Novo hook `useKpiAutoValue(year, month)` em `src/hooks/useKpiAutoValue.ts`:
  - Reutiliza a infra de `usePlanningData.getAutoValue` mas com queries filtradas ao mês corrente.
  - Resolve fontes já existentes: `bd_vendas`, `bd_crm`, `bd_clientes`, `bd_tempo`, `bd_tarefas`, `bd_equipa`, `bd_marketing`, `bd_conteudos`, `bd_reunioes`, `bd_nps`, `bd_despesas`, `bd_projetos`, `metrica`.
  - Devolve função `resolve(kpi) → number | null`.
- Cada `<KPRsInline>` chama o hook e passa o valor resolvido. Se diferente do `actual_value` em DB, faz upsert silencioso (cache da fonte para análise/sparklines).

### Insertion em blocos de área existentes
- `BlockComercial.tsx`, `BlockMarketing.tsx`, `BlockClientes.tsx`, `BlockOperacao.tsx`: adicionar no topo `<KPRsInline area="X" year={year} month={month} />` antes do conteúdo atual.

### Limpeza
- Apagar `BlockKPRs.tsx` (substituído por `KPRsInline`).
- Remover import e secção em `MonthlyCockpit.tsx`.

## Notas técnicas
- `department_kpis.value_source` já existe com default `'manual'`. Na ficha do KPR (`DepartmentKpisSection.tsx`/`DepartmentKpiDashboard.tsx`) já se pode editar — vamos garantir que mostra o select de `VALUE_SOURCES`.
- Sem migrações de schema; só código de leitura/cache.
- Sem alterar tabela `department_kpi_monthly` — continua a guardar target manual + actual em cache (atualizado pelo resolver).

Confirmas que avanço assim?
