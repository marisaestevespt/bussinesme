-- Restrict SELECT on user_roles: users can only see their own role; owners see all
DROP POLICY IF EXISTS "Authenticated can view roles" ON public.user_roles;

CREATE POLICY "Users view own role or owners view all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'owner'::app_role)
);