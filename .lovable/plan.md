## Reestruturação do Planeamento Executive

Princípio: **Executive é fonte única**. Objetivos nascem aqui e cascateiam Anual → S1/S2 → T1-T4 → Mensal. Departamentos consomem.

---

### 1. Generalizar Objetivos Anuais (8 áreas)

**Schema (`executive_objectives`):**
- Adicionar coluna `contribui_visao_5_anos boolean default false`
- Validar `area` para uma das 8: `comercial, marketing, financeiro, operacao, clientes, produtos, equipa, geral` (CHECK constraint)
- Constraint única `(area, year)` para garantir 1 objetivo anual por área/ano
- Migrar valores antigos de `area` (ex: `outro` → `geral`)

**UI (`ExecutivePlaneamentoTatico`):**
- Atualizar `TacticalByAreaView` para mostrar exatamente 8 cards (uma por área), cada um com o seu objetivo anual ou CTA "Definir objetivo".
- Form de criar/editar objetivo: campo `area` passa a Select fixo das 8; bloqueia se já existir objetivo nesse ano/área.
- Adicionar toggle **"Este objetivo contribui para a visão a 5 anos? Sim/Não"**.

**Sincronização Executive → Departamento (marketing/financeiro):**
- Trigger DB `sync_exec_objective_to_dept_goals`:
  - Quando objetivo `area='financeiro'` e `value_source` agregável → escreve/atualiza `financial_goals` por mês (distribui `target_value/12` no `revenue_target` ou conforme `target_unit`).
  - Quando objetivo `area='marketing'` → escreve/atualiza `marketing_goals` para o canal/métrica correspondente (apenas referência mensal `target_value/12`).
- Direcção é one-way; UI dos departamentos passa a marcar essas linhas como `read-only` (origem: Executive) com badge "Definido no Executive".

---

### 2. Desdobramento Semestral

**Schema (`planning_goals`):**
- Adicionar `'semestral'` como valor válido para `period_type`, com `period IN ('S1','S2')`.
- Atualizar constantes `PERIODS` em `usePlanningData` para incluir `S1`/`S2`.

**UI:**
- Em `PlanningGoalsTab`/`TacticalByAreaView`: para cada objetivo anual, mostrar uma cascata visual:
  ```text
  Anual (target / actual)
    ├─ S1 (target / actual auto)   ├─ S2
    │   └─ T1 / T2                 │   └─ T3 / T4
    │       └─ meses               │       └─ meses
  ```
- `actual_value` semestral lido automaticamente das mesmas fontes (`goalAutoValue` em `usePlanningData`) — agregando os meses correspondentes.
- Editor de meta semestral: CEO define `target`; status calculado igual aos restantes.

---

### 3. Tabela `monthly_reflection`

```sql
CREATE TABLE public.monthly_reflection (
  id uuid PK default gen_random_uuid(),
  business_id uuid not null,
  year int not null,
  month int not null CHECK (month BETWEEN 1 AND 12),
  o_que_correu_bem text,
  o_que_nao_correu text,
  decisoes_mes_seguinte text,
  revisto boolean default false,
  revisto_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(business_id, year, month)
);
```
- RLS: só `is_owner()` lê/escreve.
- UI: nova secção em `/executive/planeamento/operacional?ano&mes=` — card "Reflexão de [Mês]" com 3 textareas + botão "Marcar como revisto" (define `revisto=true, revisto_em=now()`).

---

### 4. Visão a 5 Anos

**Schema:**
```sql
CREATE TABLE public.visao_5_anos (
  id uuid PK,
  business_id uuid not null,
  ano_alvo int not null,
  onde_quero_estar jsonb, -- { negocio, equipa, produtos, mercado, vida_pessoal }
  condicoes_necessarias text,
  riscos text,
  alinhamento_anual text,
  updated_at timestamptz default now(),
  UNIQUE(business_id, ano_alvo)
);
```
- RLS: só Owner.

**UI (`ExecutivePlaneamentoEstrategico`):**
- Novo bloco "Visão a 5 Anos" depois das Diretrizes Estratégicas.
- Se vazio → CTA "Definir a tua visão a [ano+5]".
- 4 campos rich text (reaproveitar editor já usado em SWOT/Diretrizes).
- Sub-bloco 1 ("onde quero estar") expandido em 5 mini-cards: Negócio, Equipa, Produtos, Mercado, Vida pessoal.

**Indicador no planeamento anual:**
- Badge/ícone `Sparkles` ao lado do título do objetivo se `contribui_visao_5_anos=true`.
- Tooltip: "Este objetivo contribui para a tua visão a 5 anos".

---

### Detalhes técnicos

**Migrations (1 ficheiro, single transaction):**
1. `ALTER executive_objectives ADD contribui_visao_5_anos`, CHECK área, constraint única `(area, year)`, backfill `outro → geral`.
2. `ALTER planning_goals` — atualizar constraint de `period_type` para incluir `'semestral'`.
3. `CREATE TABLE monthly_reflection` + RLS owner-only + trigger updated_at.
4. `CREATE TABLE visao_5_anos` + RLS owner-only + trigger updated_at.
5. `CREATE FUNCTION sync_exec_objective_to_dept_goals()` + trigger `AFTER INSERT/UPDATE` em `executive_objectives` para `area in ('financeiro','marketing')`.

**Código:**
- `src/hooks/usePlanningData.tsx`: incluir `S1`/`S2` em `PERIODS`, agregação automática de actual semestral, expor `useMonthlyReflection` e `useVisao5Anos` (novos hooks separados).
- `src/components/planning/TacticalByAreaView.tsx`: layout fixo de 8 áreas; injectar badge visão 5 anos.
- `src/components/planning/PlanningGoalsTab.tsx`: nova vista semestral com cascata.
- `src/components/planning/StrategicSection.tsx` (ou novo `Vision5YearsBlock.tsx`): bloco de visão.
- `src/pages/ExecutivePlaneamentoEstrategico.tsx`: incluir bloco.
- `src/pages/ExecutivePlaneamentoOperacional.tsx`: incluir card de Reflexão Mensal.
- Marketing/Financeiro UI: marcar metas geradas pelo Executive com badge read-only.

**Fora de scope:**
- Reescrita das tabelas `marketing_goals` / `financial_goals` (mantemos, apenas sync via trigger).
- Notificações automáticas — fica para iteração futura.

Posso prosseguir?
