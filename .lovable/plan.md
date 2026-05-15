## O problema

Hoje a recorrência vive **só na fase**. As entregas só podem dizer "sim, repito-me a cada ciclo da fase" ou "não, sou one-shot". Isto não cobre o caso real:

> Fase **Trabalho contínuo** = mensal (ciclo da fase)
> Lá dentro:
> - Kickoff → 1 vez (one-shot)
> - Briefing → 1 vez (one-shot)
> - Reunião de status → **semanal**
> - Mensagem de check-in → **semanal**
> - Notas internas → sem data, sem cadência

Também não há forma de **reordenar fases** dentro do roadmap.

## O que vou mudar

### 1. Cadência por entrega (schema)

Adicionar à `product_deliverable_templates`:
- `cadence` — enum: `unica` (one-shot) · `por_ciclo_fase` (segue a cadência da fase, comportamento atual) · `propria` (define a sua própria cadência) · `sem_data` (existe mas não tem timing definido)
- `recurrence_frequency` — `semanal` / `quinzenal` / `mensal` (só usado quando `cadence = 'propria'`)
- `recurrence_anchor_day` — dia da semana (1-7) ou do mês (1-31)
- `recurrence_lead_days` — quantos dias úteis antes abre

Migrar dados:
- entregas com `is_recurring = true` → `cadence = 'por_ciclo_fase'`
- entregas com `is_recurring = false` numa fase recorrente → `cadence = 'unica'`
- entregas em fases não recorrentes → `cadence = 'unica'` (comportamento atual)

Manter `is_recurring` por compatibilidade (computado a partir do novo campo) até remover usages.

### 2. UI da entrega — controlo "Quando acontece?"

Dentro do editor de cada entrega (linha 2 dos metadados), substituir o checkbox "Repete em cada ciclo" por um **único select compacto** com 4 opções:

- **Uma vez** (default para entregas tipo kickoff)
- **A cada ciclo da fase** (default quando a fase é recorrente — ex: relatório mensal numa fase mensal)
- **Cadência própria…** (abre micro-form: frequência + dia)
- **Sem data** (para itens tipo "notas internas" que existem mas não geram timing)

Quando `Cadência própria` está selecionada, mostra inline: `Semanal · Sexta · abre 5 dias antes`, com botão de editar.

### 3. Reordenar fases no Roadmap

Adicionar setas ↑ ↓ no header de cada `PhaseCard` (visível só no roadmap principal — onboarding e offboarding mantêm fase única). Atualizam `sort_order` na tabela `product_phases` com o mesmo padrão de swap já usado nas entregas.

### 4. Sincronização com projetos ativos

O trigger `sync_product_deliverable_to_projects` já existe — vou estendê-lo para também sincronizar os novos campos (`cadence`, `recurrence_frequency`, etc.) sem sobrescrever datas planeadas manualmente nos projetos.

## Detalhes técnicos

- Nova migração: ALTER TABLE + backfill + atualizar trigger.
- Componentes tocados: `ProductEntregasSection.tsx` (DeliverableRow + PhaseCard).
- O badge no display estático passa a refletir a nova cadência (ex: "Semanal", "1x", "Mensal (fase)").
- Edge functions que geram tarefas/reuniões a partir de templates (`generate-deliverable-tasks`, `regenerate-recurring-meetings`) precisam de ler `cadence` em vez de `is_recurring`.

## O que NÃO vou fazer agora

- Não toco onboarding/offboarding (ficam com fase única + entregas one-shot).
- Não introduzo cadências exóticas (bi-mensal, anual) — só semanal/quinzenal/mensal.
- Não mexo na cadência da fase em si — continua a ser definida ao nível da fase.
