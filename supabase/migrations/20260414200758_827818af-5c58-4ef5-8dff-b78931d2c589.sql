
DROP POLICY IF EXISTS "Anon can read portal feedback by token" ON public.portal_feedback;

CREATE POLICY "Authenticated can read portal feedback"
ON public.portal_feedback
FOR SELECT
TO authenticated
USING (true);
