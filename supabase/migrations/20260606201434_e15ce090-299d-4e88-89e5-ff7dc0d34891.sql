
CREATE OR REPLACE FUNCTION public.is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE profile_id = auth.uid()
      AND status = 'ativo'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_team_member() TO authenticated, service_role;

-- commercial-files
DROP POLICY IF EXISTS "Authenticated can view commercial files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload commercial files" ON storage.objects;
DROP POLICY IF EXISTS "Commercial files: dept read" ON storage.objects;
DROP POLICY IF EXISTS "Commercial files: dept upload" ON storage.objects;

CREATE POLICY "Commercial files: dept read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'commercial-files'
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.user_in_department('comercial')
    OR public.user_in_department('financeiro')
  )
);

CREATE POLICY "Commercial files: dept upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'commercial-files'
  AND (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.user_in_department('comercial')
    OR public.user_in_department('financeiro')
  )
);

-- project/meeting/event/mural files: team-members only
DROP POLICY IF EXISTS "Anyone can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload project files" ON storage.objects;
DROP POLICY IF EXISTS "Project files: team read" ON storage.objects;
DROP POLICY IF EXISTS "Project files: team upload" ON storage.objects;
CREATE POLICY "Project files: team read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'project-files' AND public.is_team_member());
CREATE POLICY "Project files: team upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-files' AND public.is_team_member());

DROP POLICY IF EXISTS "Anyone authenticated can view meeting files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload meeting files" ON storage.objects;
DROP POLICY IF EXISTS "Meeting files: team read" ON storage.objects;
DROP POLICY IF EXISTS "Meeting files: team upload" ON storage.objects;
CREATE POLICY "Meeting files: team read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meeting-files' AND public.is_team_member());
CREATE POLICY "Meeting files: team upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'meeting-files' AND public.is_team_member());

DROP POLICY IF EXISTS "Anyone can view event files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload event files" ON storage.objects;
DROP POLICY IF EXISTS "Event files: team read" ON storage.objects;
DROP POLICY IF EXISTS "Event files: team upload" ON storage.objects;
CREATE POLICY "Event files: team read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'event-files' AND public.is_team_member());
CREATE POLICY "Event files: team upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-files' AND public.is_team_member());

DROP POLICY IF EXISTS "Anyone can view mural files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload mural files" ON storage.objects;
DROP POLICY IF EXISTS "Mural files: team read" ON storage.objects;
DROP POLICY IF EXISTS "Mural files: team upload" ON storage.objects;
CREATE POLICY "Mural files: team read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'mural-files' AND public.is_team_member());
CREATE POLICY "Mural files: team upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mural-files' AND public.is_team_member());
