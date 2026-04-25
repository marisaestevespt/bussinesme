-- ============================================================
-- 1. Fix RLS policies "USING (true)" em routines e marketing_monthly_analysis
-- ============================================================

-- routines: era ALL com qual=true, with_check=true → qualquer pessoa autenticada podia tudo
DROP POLICY IF EXISTS "auth manage routines" ON public.routines;

CREATE POLICY "Authenticated can view routines"
ON public.routines FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert routines"
ON public.routines FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creator or admin can update routines"
ON public.routines FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.is_admin_or_owner())
WITH CHECK (created_by = auth.uid() OR public.is_admin_or_owner());

CREATE POLICY "Creator or admin can delete routines"
ON public.routines FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR public.is_admin_or_owner());

-- marketing_monthly_analysis: era ALL com qual=true, with_check=true
DROP POLICY IF EXISTS "auth manage marketing_monthly_analysis" ON public.marketing_monthly_analysis;

CREATE POLICY "Authenticated can view marketing_monthly_analysis"
ON public.marketing_monthly_analysis FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert marketing_monthly_analysis"
ON public.marketing_monthly_analysis FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update marketing_monthly_analysis"
ON public.marketing_monthly_analysis FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete marketing_monthly_analysis"
ON public.marketing_monthly_analysis FOR DELETE
TO authenticated
USING (public.is_admin_or_owner());

-- ============================================================
-- 2. Restringir LISTAGEM em buckets públicos (logos, custom-fonts, personal-images).
-- Mantemos acesso direto por URL (ficheiros públicos continuam visíveis quando se conhece o path),
-- mas removemos a possibilidade de listar todos os objects do bucket sem autenticação.
-- ============================================================

-- logos
DROP POLICY IF EXISTS "Logo images are publicly accessible" ON storage.objects;
CREATE POLICY "Authenticated can list logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'logos');

-- custom-fonts
DROP POLICY IF EXISTS "Anyone can view fonts" ON storage.objects;
CREATE POLICY "Authenticated can list fonts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'custom-fonts');

-- personal-images
DROP POLICY IF EXISTS "Personal images are publicly readable" ON storage.objects;
CREATE POLICY "Authenticated can list personal images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'personal-images');