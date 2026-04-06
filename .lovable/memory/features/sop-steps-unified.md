---
name: Unified SOP Steps
description: SOP steps stored in sop_steps table with deadline, trigger, responsible, portal_visible, and linked documents
type: feature
---
SOP steps are now stored in `sop_steps` table (not jsonb array in sops.passos).

## sop_steps fields
- description, sort_order, deadline_days, deadline_unit, deadline_trigger, responsible, portal_visible

## sop_step_documents
- Linked via step_id FK to sop_steps
- Types: email, mensagem, documento, template
- Has title + content fields with variable placeholders

## UI
- Each step row: description + eye toggle (portal visibility) + paperclip (docs) + expand (deadline/trigger/responsible) + delete
- Docs shown inline when paperclip clicked
- Template onboarding/offboarding sections removed — unified into steps with portal_visible toggle

## Portal integration
- Steps with portal_visible=true appear in client portal checklist
- When SOP is applied to client, portal-visible steps become the onboarding/offboarding checklist
