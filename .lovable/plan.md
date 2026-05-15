## Objetivo

Resolver a confusão dos serviços mensais recorrentes. Ao definir um produto recorrente com ciclo de N meses + itens recorrentes (reunião semanal, entrega mensal, etc.), o sistema gera **automaticamente todas as ocorrências do ciclo inteiro** no projeto do cliente. Ficam visíveis no roadmap principal e no portal, podem ser editadas individualmente (datas, responsável), e a análise sabe contar "X de Y feitas".

## Arquitetura

### 1. Conceitos finais (claros e separados)

| Conceito | Onde vive | Quem vê | Para quê |
|---|---|---|---|
| **Fases & Entregáveis** | Produto → Projeto → Portal | Cliente + equipa | Marcos do projeto (já existe, não muda) |
| **Itens Recorrentes do Ciclo** | Produto → Projeto → Portal | Cliente + equipa | Reuniões, entregas e tarefas que se repetem dentro de um ciclo (ex: reunião semanal, relatório mensal) |
| **Rotinas internas** | Projeto (sem template) | Só equipa | Tarefas operacionais internas (ex: "verificar inbox todas as 6ª") — fica como está, não cliente-facing |

### 2. Schema (migrations)

**a) Adicionar a `projects`:**
- `cycle_duration_months` (int, nullable) — herda do produto na criação
- `cycle_start_date` (date, nullable) — = start_date por defeito
- `cycle_renewable` (bool, default false) — se renova automaticamente

**b) Adicionar a `products`:**
- `cycle_renewable` (bool, default false) — fixo vs renovável
- (já existe `cycle_duration` — passa a ser interpretado como meses se `default_project_mode='recorrente'`)

**c) Nova tabela `product_recurring_items`** (template no produto):
```
id, product_id, name, description, sort_order,
item_type ('reuniao' | 'tarefa' | 'entrega'),
frequency ('semanal' | 'quinzenal' | 'mensal' | 'trimestral'),
day_of_week (0-6, nullable),     -- para semanal/quinzenal
day_of_month (1-31, nullable),   -- para mensal
week_of_month (1-4, nullable),   -- ex: "1ª 2ª-feira do mês"
duration_minutes (int, nullable),-- para reuniões
visible_in_portal (bool, default true),
linked_sop_id, default_responsible_role
```

**d) Nova tabela `project_recurring_occurrences`** (instâncias geradas):
```
id, project_id, source_recurring_item_id (nullable, fica null se manual),
item_type, name, description,
scheduled_date (date), scheduled_time (time, nullable),
status ('pendente' | 'concluida' | 'cancelada' | 'reagendada'),
linked_meeting_id (nullable), linked_task_id (nullable), linked_deliverable_id (nullable),
visible_in_portal, sort_order
```
Quando uma ocorrência é "ativada" (chega o dia ou alguém clica), cria a meeting/task/deliverable real e liga via `linked_*_id`. Isto evita poluir as tabelas principais com 50 reuniões "futuras".

### 3. Fluxos

**Criar produto recorrente:**
1. Define `cycle_duration` (ex: 6 meses) + `cycle_renewable` (sim/não)
2. Adiciona itens recorrentes (ex: "Reunião semanal de status — 2ª-feira, 60min, visível no portal")

**Criar projeto a partir do produto:**
1. Herda `cycle_duration_months`, `cycle_renewable`, `cycle_start_date` = start_date
2. Função `generate_cycle_occurrences(project_id)` calcula e insere TODAS as ocorrências do ciclo em `project_recurring_occurrences` (ex: 6 meses × reunião semanal = ~26 linhas)
3. Aparece no roadmap do projeto

**Editar individualmente:**
- Cada ocorrência tem date editável (drag/click) → não mexe nas restantes
- "Apagar esta ocorrência" → status='cancelada'
- "Editar série" → mexe no item template + opção "regenerar futuras"

**Renovação:**
- Cron/edge function corre mensalmente: se `cycle_renewable=true` e o ciclo está a 30 dias do fim → gera próximo ciclo automaticamente (ou notifica para confirmar, conforme setting)

**Portal cliente:**
- Nova secção "Cronograma" no portal mostra timeline do ciclo: fases + entregáveis + ocorrências recorrentes visíveis, ordenadas por data
- Não é tab separada — integra-se no roadmap existente

**Análise de projeto:**
- Para projetos com ciclo: barra "Mês 3 de 6" + métricas "X/Y reuniões realizadas, X/Y entregas concluídas"

### 4. Migração de dados existentes

Edge function `migrate-recurring-meetings` (one-shot):
- Para cada `meetings` com `is_recurring=true` + `recurrence_end_date`:
  - Expande nas datas individuais
  - Cria entradas em `project_recurring_occurrences` ligadas via `linked_meeting_id` à reunião original
  - Marca a reunião original como "série migrada"

### 5. UI a alterar

- **`ProdutoDetail.tsx`**: nova secção "Itens Recorrentes do Ciclo" (quando `default_project_mode='recorrente'`), com inputs de ciclo e renovação
- **`ProjetoDetail.tsx`**: na tab "Overview" mostra barra "Ciclo: Mês 3/6", botão "Regenerar ocorrências"; no roadmap inclui as occurrences
- **`ProjectProcessosSection.tsx`**: substitui as secções confusas "Rotinas/Tarefas Fixas" + "Tarefas do Mês" por **"Itens Recorrentes do Ciclo"** (lista com timeline editável) + "Rotinas Internas" (só equipa, opcional)
- **Portal**: nova secção cronograma na PortalClientes
- **Análise**: cards de progresso do ciclo

## Implementação por fases (entregáveis testáveis)

**Fase 1 — Schema + Geração** (este sprint)
- Migrations das 4 alterações de schema
- Função SQL `generate_cycle_occurrences(project_id)` (idempotente — só insere o que falta)
- Trigger ao criar projeto a partir de produto recorrente: chama a função
- Botão "Sincronizar com produto" passa a chamar também esta função

**Fase 2 — UI Produto + Projeto**
- Editor de itens recorrentes em ProdutoDetail
- Lista de ocorrências em ProjetoDetail (Fluxo de Trabalho) com edição inline de datas e cancelamento individual
- Barra "Mês X de Y" no header do projeto

**Fase 3 — Migração + Portal + Análise**
- Edge function de migração das `meetings` recorrentes existentes
- Cronograma no portal cliente
- Cards de análise por ciclo
- Cron de renovação automática (para `cycle_renewable=true`)

## O que NÃO muda

- Fases & Entregáveis (já funciona bem)
- `planning_routines` (rotinas internas) — fica para tarefas operacionais da equipa
- Reuniões pontuais (não-recorrentes) — fluxo atual mantém-se
- Permissões e RLS existentes

## Decisões a confirmar antes de começar

1. **Renovação automática vs notificação**: ao chegar fim do ciclo, gera novo ciclo silenciosamente, ou cria notificação "ciclo termina em 30 dias, queres renovar?"
2. **Reuniões geradas: criar logo na tabela `meetings` ou só ativar na hora?** Recomendo só criar quando chega a 1 semana antes (cron diário) — caso contrário polui agendas com 26 reuniões fantasma
3. **Nome final**: "Itens Recorrentes do Ciclo" ou simplesmente "Recorrências" / "Ciclo de Avença"?
