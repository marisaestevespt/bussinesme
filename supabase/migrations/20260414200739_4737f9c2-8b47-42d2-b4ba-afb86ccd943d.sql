
DROP POLICY IF EXISTS "Public can read portal feedback" ON public.portal_feedback;
DROP POLICY IF EXISTS "Anon can read portal feedback" ON public.portal_feedback;
DROP POLICY IF EXISTS "Anyone can read portal feedback" ON public.portal_feedback;

CREATE POLICY "Anon can read portal feedback by token"
ON public.portal_feedback
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.client_portals cp
    WHERE cp.id = portal_id
      AND cp.is_active = true
  ) = false
);
