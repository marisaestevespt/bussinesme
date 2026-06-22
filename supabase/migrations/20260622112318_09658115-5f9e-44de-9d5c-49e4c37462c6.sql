
-- Helper to safely extract first path segment as uuid
CREATE OR REPLACE FUNCTION public.storage_path_first_uuid(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_first text;
  v_uuid uuid;
BEGIN
  v_first := split_part(_name, '/', 1);
  BEGIN
    v_uuid := v_first::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN v_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.storage_path_first_uuid(text) TO authenticated, service_role;

-- ============ deliverable-documents ============
DROP POLICY IF EXISTS "Authenticated can view deliverable documents"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload deliverable documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update deliverable documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete deliverable documents" ON storage.objects;

CREATE POLICY "Project members can view deliverable documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'deliverable-documents'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
);

CREATE POLICY "Project members can upload deliverable documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deliverable-documents'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
);

CREATE POLICY "Project members can update deliverable documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'deliverable-documents'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
)
WITH CHECK (
  bucket_id = 'deliverable-documents'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
);

CREATE POLICY "Project members can delete deliverable documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'deliverable-documents'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
);

-- ============ project-assets ============
DROP POLICY IF EXISTS "Authenticated can read project-assets"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload project-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update project-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete project-assets" ON storage.objects;

CREATE POLICY "Project members can read project-assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-assets'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
);

CREATE POLICY "Project members can upload project-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-assets'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
);

CREATE POLICY "Project members can update project-assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'project-assets'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
)
WITH CHECK (
  bucket_id = 'project-assets'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
);

CREATE POLICY "Project members can delete project-assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-assets'
  AND public.can_edit_project(public.storage_path_first_uuid(name))
);

-- ============ traffic-reports (restrict SELECT to owner) ============
DROP POLICY IF EXISTS "Authenticated can view traffic report files" ON storage.objects;

CREATE POLICY "Owners can view traffic report files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'traffic-reports'
  AND public.has_role(auth.uid(), 'owner'::app_role)
);
