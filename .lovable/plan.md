# Reuniões: previsto vs real, com origem coerente

## Objetivo
Toda reunião passa a ter **tempo previsto** (estimado) e **tempo real** (decorrido). O previsto vem alimentado pela origem (entrega de produto, rotina, ou input manual). O real entra após a reunião e é o que conta para produtividade/desvios.

## Mudanças

### 1. Schema (migração)

**`meetings`** — separar os dois campos:
- `planned_duration_minutes` (int, nullable) — tempo previsto
- `actual_duration_minutes` (int, nullable) — tempo real
- Migrar `duration_minutes` atual → copiar para ambos os campos como ponto de partida; manter `duration_minutes` como coluna gerada/legada por compatibilidade (ou eliminar e ajustar todos os call-sites — preferível).

**`planning_routines`** — passar a ter formato + duração (espelhando entregas):
- `format` (text, nullable) — `reuniao`, `tarefa`, `entrega`, `outro`
- `estimated_minutes` (int, nullable) — tempo previsto
  Quando `format='reuniao'` e a rotina gera ocorrências, gera **meeting** (não task) com `planned_duration_minutes = estimated_minutes`.

**`sops`** — adicionar `estimated_minutes` (int, nullable) para alinhar.

### 2. Cascata do tempo previsto (ao criar meeting)

Prioridade ao popular `planned_duration_minutes`:
1. `project_deliverables.estimated_minutes` (se meeting nasce de entrega)
2. `planning_routines.estimated_minutes` (se nasce de rotina)
3. `MEETING_TEMPLATES[type].defaultDurationMinutes` (template do produto)
4. Vazio (input manual)

Aplicar nos pontos de criação:
- `generate-deliverable-tasks` / trigger de entrega→reunião
- `generate-routine-tasks` + `regenerate-recurring-meetings` (gerar meetings quando rotina é formato reunião)
- Form manual em `Reunioes.tsx` / `ReuniaoDetail.tsx` / `Agenda.tsx` (pré-preenche a partir do template)

### 3. UI

**Form/detalhe da reunião** (`ReuniaoDetail.tsx`, dialog em `Reunioes.tsx`, `Agenda.tsx`):
- Dois campos lado a lado: "Previsto (min)" e "Real (min)"
- Real arranca vazio; ao marcar reunião como concluída, prompt suave a pedir o real (default = previsto)
- Badge no card a mostrar desvio quando há ambos (ex.: "60' previsto · 80' real · +33%")

**Rotinas** (`ProjectRoutines.tsx` e gestão em `/hub/tarefas?tab=rotinas`):
- Novo seletor de **Formato** (reunião / tarefa / entrega)
- Campo **Tempo previsto (min)**
- Quando formato = reunião, geração cria meeting em vez de task

**SOPs**: campo estimated_minutes editável.

### 4. Produtividade

`ExecutiveProductivity.tsx` (`useMemo` que constrói virtual entries de meetings):
- Passar a usar `actual_duration_minutes ?? planned_duration_minutes` (preferir real; cair para previsto se ainda não preenchido).
- Nova métrica: **desvio reuniões** = soma(real − previsto), quebrada por cliente / interno / rotina.
- Sinal de alerta no `OverloadTab` quando média de desvio > 20% num período.

### 5. Compatibilidade
- Onde código lê `duration_minutes` (agenda render, time-tracking `calcTotalTime`, exports), trocar para o novo getter `actual ?? planned`.
- Memory `time-tracking-analysis.md` atualizada para refletir os dois campos.

## Detalhe técnico

```text
meeting.duration_minutes (legacy)
        │
        ├─► planned_duration_minutes  ◄── cascade (deliverable/routine/template)
        └─► actual_duration_minutes   ◄── preenchido pós-reunião

routine.format = 'reuniao' + estimated_minutes
        └─► gera meeting com planned_duration_minutes
```

Ficheiros principais a tocar:
- migração SQL (meetings + planning_routines + sops)
- `src/pages/{Reunioes,ReuniaoDetail,Agenda}.tsx`
- `src/components/project/ProjectRoutines.tsx` + página rotinas
- `src/hooks/usePlanningRoutines.tsx` (gerar meeting quando formato=reunião)
- `supabase/functions/generate-routine-tasks/index.ts`
- `supabase/functions/regenerate-recurring-meetings/index.ts`
- `supabase/functions/generate-deliverable-tasks/index.ts`
- `src/pages/ExecutiveProductivity.tsx` (usar actual ?? planned + métrica desvio)
- `src/lib/meetingStatus.ts` ou novo helper `meetingDuration.ts`

## Fora de âmbito (confirmar se queres incluir)
- Timer "ao vivo" para reuniões (start/stop) — por agora só input manual do real.
- Histórico de versões do previsto.
