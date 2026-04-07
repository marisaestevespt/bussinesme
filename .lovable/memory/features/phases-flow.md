---
name: Phases & Deliverables Flow
description: Product→Project→Portal phases/deliverables with timeline duration rules
type: feature
---
## Architecture
- **Product** (template): `product_phases` + `product_deliverable_templates` with optional `linked_sop_id`
- **Project** (instance): `project_phases` + `project_deliverables` copied when template applied
- **Portal** (client view): `get_portal_phases` RPC returns jsonb with phases + deliverables + planned dates

## Timeline Rules (on phases)
- `duration_days`: how many days the phase lasts
- `duration_unit`: `dias_uteis` (business days) or `dias_corridos` (calendar days)
- `offset_days`: days after trigger reference point
- `offset_trigger`: `inicio_projeto` or `fase_anterior`
- `planned_start` / `planned_end`: calculated dates on project_phases, editable per project

## Key decisions
- SOPs are ALWAYS internal — never shown to clients
- `portal_timeline_phases` table DROPPED — project_phases is single source of truth
- `sop_steps.portal_visible` column REMOVED
- Each phase and deliverable can link to a SOP internally via `linked_sop_id`
- Phase status changes in project reflect automatically in portal
- Deliverable statuses: pendente, em_progresso, concluido
- Phase statuses: pendente, em_curso, concluida
- Timeline configured at product level, auto-calculated at project level but manually editable
- Portal shows planned_start/planned_end dates
