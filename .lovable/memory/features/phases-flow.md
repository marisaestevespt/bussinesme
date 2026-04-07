---
name: Phases & Deliverables Flow
description: Product→Project→Portal phases/deliverables single source of truth
type: feature
---
## Architecture
- **Product** (template): `product_phases` + `product_deliverable_templates` with optional `linked_sop_id`
- **Project** (instance): `project_phases` + `project_deliverables` copied when template applied
- **Portal** (client view): `get_portal_phases` RPC returns jsonb with phases + deliverables

## Key decisions
- SOPs are ALWAYS internal — never shown to clients
- `portal_timeline_phases` table DROPPED — project_phases is single source of truth
- `sop_steps.portal_visible` column REMOVED
- Each phase and deliverable can link to a SOP internally via `linked_sop_id`
- Phase status changes in project reflect automatically in portal
- Deliverable statuses: pendente, em_progresso, concluido
- Phase statuses: pendente, em_curso, concluida
