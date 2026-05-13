SOP-driven onboarding: when a member is created, create-member reads `sop_steps` (NOT sops.inputs) of any SOP with sop_type='onboarding' matching the role_title, and creates one member_onboarding row per step linked back via sop_step_id (+ sop_id).

## Tables
- `sop_steps`: source of truth for onboarding steps (description, deadline_days, deadline_unit, sort_order)
- `sop_step_documents`: typed materials per step — document_type ∈ (email|mensagem|documento|template|link|ficheiro), title, subject (email), content, url (link), file_name/file_url (ficheiro). file_name/file_url are nullable.
- `member_onboarding`: task, deadline_date, completed, sop_id, sop_step_id (nullable when manually added)

## Flow
1. Owner creates a SOP with sop_type='onboarding' + role_title in Processos
2. Adds steps; each step can have multiple typed documents (emails, messages, templates, files, links)
3. create-member edge fn loads matching SOPs → reads sop_steps → inserts member_onboarding rows with sop_step_id
4. deadline_date = today + deadline_days × multiplier (dias=1, semanas=7, meses=30); fallback 7 days
5. Secretária + MemberDetailSheet render OnboardingItem (src/components/onboarding/OnboardingItem.tsx) which expands to show step's documents with copy/mailto/open actions

## UI
- OnboardingItem: shared component, fetches sop_step_documents on expand
- Secretária dashboard "O Teu Onboarding" card uses it
- MemberDetailSheet "Onboarding" tab uses it (with delete button overlay)

## Notes
- Manual items (added via "Novo item..." input) have sop_step_id=null and are non-expandable
- Old behavior reading sops.inputs is gone
