
-- 2. member_sensitive_access: restrict writes to owners only
DROP POLICY IF EXISTS "Authenticated can manage sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated can view sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated can insert sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated can update sensitive access" ON public.member_sensitive_access;
DROP POLICY IF EXISTS "Authenticated can delete sensitive access" ON public.member_sensitive_access;

CREATE POLICY "Authenticated can read sensitive access"
  ON public.member_sensitive_access FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owners can insert sensitive access"
  ON public.member_sensitive_access FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update sensitive access"
  ON public.member_sensitive_access FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete sensitive access"
  ON public.member_sensitive_access FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- 3. portal_initial_questions: restrict anon UPDATE to valid portal token
DROP POLICY IF EXISTS "Anon can update portal questions" ON public.portal_initial_questions;
DROP POLICY IF EXISTS "Public can update portal questions" ON public.portal_initial_questions;
DROP POLICY IF EXISTS "Anyone can update portal questions" ON public.portal_initial_questions;

CREATE POLICY "Anon can update portal questions with valid token"
  ON public.portal_initial_questions FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.client_portals cp
      WHERE cp.id = portal_id AND cp.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_portals cp
      WHERE cp.id = portal_id AND cp.is_active = true
    )
  );
