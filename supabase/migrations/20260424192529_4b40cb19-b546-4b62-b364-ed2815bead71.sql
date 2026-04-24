-- Phase 4 cleanup: drop orphan SOP offboarding tables.
-- Confirmed unused: 0 rows, 0 application code references (only present in
-- types.ts and the recovery migration). They were recreated by the Phase 2
-- rollback but were already dead before that. Their only FK is internal
-- (sop_offboarding_items.template_id -> sop_offboarding_templates).
-- The active offboarding flow uses `client_offboarding` and
-- `product_offboarding_templates`, which remain intact.

DROP TABLE IF EXISTS public.sop_offboarding_items CASCADE;
DROP TABLE IF EXISTS public.sop_offboarding_templates CASCADE;