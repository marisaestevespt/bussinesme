
DROP POLICY IF EXISTS "Public can read business settings" ON public.business_settings;

CREATE POLICY "Authenticated can read business settings"
ON public.business_settings
FOR SELECT
TO authenticated
USING (true);
