DROP POLICY IF EXISTS "Self or admin views profile" ON public.profiles;

CREATE POLICY "Authenticated can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);