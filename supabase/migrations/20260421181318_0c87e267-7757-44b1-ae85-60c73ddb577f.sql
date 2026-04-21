
-- Portal anon residuals
DROP POLICY IF EXISTS "Portal comments publicly insertable by client" ON public.portal_comments;
DROP POLICY IF EXISTS "Portal feedback publicly insertable" ON public.portal_feedback;
DROP POLICY IF EXISTS "Anon can update portal questions with valid token" ON public.portal_initial_questions;
DROP POLICY IF EXISTS "Portal questions publicly readable and updatable" ON public.portal_initial_questions;
DROP POLICY IF EXISTS "Public read portal materials" ON public.portal_materials;
DROP POLICY IF EXISTS "Monthly summaries publicly readable" ON public.portal_monthly_summaries;
DROP POLICY IF EXISTS "Anon can read portal project history" ON public.portal_project_history;
DROP POLICY IF EXISTS "Timeline phases publicly readable" ON public.portal_timeline_phases;

-- Storage buckets — drop legacy public read policies
DROP POLICY IF EXISTS "Anyone can read financial files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read library files" ON storage.objects;

-- Backups — remove permissive duplicate
DROP POLICY IF EXISTS "Authenticated users can view backups" ON public.backups;
