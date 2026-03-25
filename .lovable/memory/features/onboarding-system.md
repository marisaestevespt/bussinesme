SOP-based onboarding system: templates linked by role_title, auto-copied to member_onboarding on creation.

## Tables
- `sop_onboarding_templates`: role_title (unique), sop_id (optional FK to sops)
- `sop_onboarding_items`: template_id, task, deadline_days (relative), sort_order
- `member_onboarding`: added deadline_date, source_template_id columns

## Flow
1. Owner creates SOP onboarding template for a role_title (e.g. "Designer")
2. When creating member via edge function `create-member`:
   - Looks for template matching role_title (case-insensitive)
   - If found: copies items to member_onboarding with calculated dates (today + deadline_days)
   - If not found: tries "Geral" fallback template
   - If neither: returns onboarding_warning in response
3. Frontend (ExecutiveGestaoEquipa.tsx) shows toast.warning if no template found
4. Secretária shows onboarding checklist card with progress bar and checkboxes

## UI Location
- Onboarding checklist appears at top of Secretária dashboard (before summary cards)
- Only shows if items exist and not all completed
- Members can check off items directly
