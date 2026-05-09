---
name: meeting-duration-planned-actual
description: Reuniões têm planned_duration_minutes vs actual_duration_minutes; rotinas têm format + estimated_minutes
type: feature
---
**Schema:**
- `meetings.planned_duration_minutes` (int, nullable) — tempo previsto, alimentado em cascata
- `meetings.actual_duration_minutes` (int, nullable) — tempo real, registado pós-reunião
- `meetings.duration_minutes` — campo legado mantido por compat; sincronizado com `planned` ao criar
- `meetings.routine_id` (uuid) — link para a rotina que gerou a reunião
- `planning_routines.format` (text, default 'tarefa') — `tarefa` | `reuniao` | `entrega`
- `planning_routines.estimated_minutes` (int) — tempo previsto em minutos (espelha `estimated_time` em h)
- `sops.estimated_minutes` (int)

**Cascata do `planned_duration_minutes` ao criar uma reunião:**
1. `project_deliverables.estimated_minutes` (entrega de produto) — passado via `defaultPlannedMinutes` em `NewMeetingButton` (DeliverableFormatCell)
2. `planning_routines.estimated_minutes` — usado pelo `generate-routine-tasks` quando `format='reuniao'`
3. `MEETING_TEMPLATES[type].defaultDurationMinutes` — fallback dentro de `MeetingFormDialog`
4. Vazio (input manual)

**Geração de rotinas:**
- `generate-routine-tasks`: se `routine.format='reuniao'` insere em `meetings` (não em `tasks`), com `routine_id`, `planned_duration_minutes`, hora vinda de `hour_time` (default 09:00). Deduplica por `routine_id + dia`.
- Caso contrário continua a gerar `tasks` como antes.

**Recorrências de reuniões:**
- `regenerate-recurring-meetings` propaga `planned_duration_minutes` da reunião pai; `actual_duration_minutes` arranca null.

**UI:**
- `ReuniaoDetail`: dois `EntityProperty` (Tempo previsto / Tempo real). Badge de desvio quando ambos preenchidos.
- `MeetingFormDialog` (Reunioes.tsx): novo input "Tempo previsto (min)" com pré-fill cascata.
- `RotinasView`: novo seletor de Formato + input "Tempo previsto (min)".

**Produtividade:**
- `ExecutiveProductivity` e `SecretariaProdutividade` calculam horas a partir de `actual_duration_minutes ?? planned_duration_minutes ?? duration_minutes`.
- `useProjectDetailData` e `Projetos` somam tempo de reunião com a mesma fallback.

**Helper:** `src/lib/meetingDuration.ts` — `effectiveMeetingMinutes()` e `meetingDeviation()`.
