-- Drop unused portal_materials table and show_materials flag.
-- Internal team attachments now live in the project "Recursos" sub-page.
-- Client-facing items remain in project_deliverables (synced to portal).

DROP FUNCTION IF EXISTS public.get_portal_materials(text);
DROP TABLE IF EXISTS public.portal_materials CASCADE;
ALTER TABLE public.client_portals DROP COLUMN IF EXISTS show_materials;