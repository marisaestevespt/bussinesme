Team management & productivity refactoring (2026-03-25): clear separation between people and operations.

## Gestão de Equipa (People Hub)
- Dashboard: membros ativos, contratos a expirar, pagamentos em atraso, feedback recente (30d), escala mensal
- Sub-pages: Equipa CRUD, Escala, Feedback, Contratos & Pagamentos
- NO performance/task views (moved to Produtividade)
- Title changed to "Gestão de Equipa" with subtitle about people focus
- Removed "performance" from HR_SECTIONS nav and RecursosHumanosSubPage

## Produtividade & Capacidade (Operations Analysis)
- Overview: 4 operational summary cards (horas semana, em atraso, tarefas semana, sobrecarga) + charts + top member highlight
- Tempo: Interno vs Cliente, Por Cliente, Registo de Tempo
- Capacidade: Ocupação da equipa (with FdS/feriados), Simulador de clientes
- Simulação: Contratação, Departamentos
- Sobrecarga: Top tarefas por tempo, tendência 4 semanas

## Deleted
- SharedProductivityViews.tsx (dead code, not imported anywhere)
- GestaoSummaryCards logic incorporated into Produtividade Overview tab
- TabPerformance removed from Gestão (was duplicating productivity analysis)
