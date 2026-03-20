-- Allow anon to read client email by id (for portal auth matching)
CREATE POLICY "Portal anon can read client email"
ON public.clients
FOR SELECT
TO anon
USING (true);

-- Allow anon to read client_contacts email for portal auth matching
CREATE POLICY "Portal anon can read contacts for auth"
ON public.client_contacts
FOR SELECT
TO anon
USING (true);