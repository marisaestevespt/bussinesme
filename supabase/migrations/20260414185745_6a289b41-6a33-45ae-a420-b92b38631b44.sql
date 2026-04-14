
DROP POLICY IF EXISTS "Authenticated users can read backups" ON public.backups;
DROP POLICY IF EXISTS "Authenticated can read backups" ON public.backups;

CREATE POLICY "Only owners can read backups"
ON public.backups
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner'));
