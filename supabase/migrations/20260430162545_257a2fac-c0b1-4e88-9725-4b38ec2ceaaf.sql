DROP POLICY IF EXISTS "Authenticated can update project_assets" ON public.project_assets;
DROP POLICY IF EXISTS "Authenticated can delete project_assets" ON public.project_assets;

CREATE POLICY "Owner can update project_assets"
ON public.project_assets FOR UPDATE TO authenticated
USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner can delete project_assets"
ON public.project_assets FOR DELETE TO authenticated
USING (auth.uid() = created_by);