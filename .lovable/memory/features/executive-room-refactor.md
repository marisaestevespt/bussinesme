Executive Room refactoring (2026-03-25): cleaned up duplicated planning systems and modularized Weekly Align.

## Changes
- `useExecutiveData` cleaned: removed objectives/goals (now only in usePlanningData). Keeps Brain Dump, checklists, routines, quarterly analysis.
- Weekly Align (1212→~350 lines main file) split into: WeeklyAlignKpis.tsx, WeeklyAlignSections.tsx (MetasSection, AgendaSection, VendasSection, LeadsSection, ClientesSection, NpsSection, ExpiringContractsSection, OperacaoSection)
- Removed unused `exec` import from Weekly Align (was importing useExecutiveData but never using it)
- Dashboard uses `exec` only for Brain Dump, `planning` for objectives/goals
- Produtividade stays in Executive Room (business management analysis)
- Brain Dump left as-is per user request
