
ALTER TABLE public.business_setup ALTER COLUMN email_test_redirect DROP DEFAULT;

CREATE POLICY "Owners can read email send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS portal_visits_insert_validated ON public.portal_visits;
CREATE POLICY portal_visits_insert_validated
ON public.portal_visits
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_portals cp
    WHERE cp.id = portal_visits.portal_id
      AND cp.is_active = true
      AND portal_email_allowed(cp.token, portal_visits.email)
  )
);
