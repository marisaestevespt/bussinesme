Planning system improvements: primary_metric_id on objectives, auto-status on goals, deviation alerts.

## Changes made
- Added `primary_metric_id` column to `executive_objectives` (FK → objective_metrics)
- Added `value_source: 'metrica'` option — objectives can derive progress from any tracked metric
- `computeGoalStatus()` auto-calculates: actual ≥ target → atingido, month ended + below → nao_atingido
- `getGoalsWithDeviations()` returns goals with actual < target in current/past months
- Deviation count card added to ExecutivePlaneamento pulse (5th KPI card)
- GoalsSection and PlanningGoalsTab show "(auto)" badge when computed status differs from stored
- ObjectiveDetailSheet allows selecting primary metric when value_source is 'metrica'
