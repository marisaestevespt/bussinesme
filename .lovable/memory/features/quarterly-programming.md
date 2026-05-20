---
name: Quarterly programming
description: Trimestre em /planeamento tem 3 sub-tabs (Retrospetiva Q-1, Estado Q, Programação Q+1) com tema/prioridades/marcos/riscos/capacidade/financeiro por área
type: feature
---
Tabelas: `quarterly_plans` (1 por area+year+quarter: theme, retrospective, capacity_notes, financial_notes) e `quarterly_items` (kind: priority|risk|milestone|learning).
Hook: `useQuarterlyPlan(year, quarter)` + helper `shiftQuarter`.
Vistas: `QuarterlyRetrospectiveView` (KRs concluídos + aprendizagens), `QuarterlyObjectivesList` (estado vigente), `QuarterlyProgrammingView` (programação do próximo Q).
Wireup: `QuarterlySubTabs` em `src/pages/Planeamento.tsx`, dentro do TabsContent `trimestre`.