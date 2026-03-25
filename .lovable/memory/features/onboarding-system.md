SOP-based onboarding system: templates linked by role_title + department, auto-copied to member_onboarding on creation.

## Tables
- `sop_onboarding_templates`: role_title, department (unique together), sop_id (optional FK to sops)
- `sop_onboarding_items`: template_id, task, deadline_days (relative), sort_order
- `member_onboarding`: added deadline_date, source_template_id columns

## Flow
1. Owner creates SOP onboarding template within DepartmentProcessos (section "Onboarding por Função")
2. Template is linked to a department + role_title (e.g., Marketing > Designer)
3. Creating the template also auto-creates a linked SOP ("Onboarding — Designer")
4. When creating member via edge function `create-member`:
   - Looks for template matching role_title (case-insensitive)
   - If found: copies items to member_onboarding with calculated dates (today + deadline_days)
   - If not found: tries "Geral" fallback template
   - If neither: returns onboarding_warning in response
5. Frontend (ExecutiveGestaoEquipa.tsx) shows toast.warning if no template found
6. Secretária shows onboarding checklist card with progress bar and checkboxes

## UI Locations
- Template management: DepartmentProcessos component (Processos page per department)
- Member view: Secretária dashboard ("O Teu Onboarding" card, before summary cards)
- Checklist disappears when all items completed
