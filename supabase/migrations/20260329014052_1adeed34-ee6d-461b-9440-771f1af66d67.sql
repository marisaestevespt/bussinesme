-- Fix team_members: only owners can delete/insert, all authenticated can read/update
DROP POLICY IF EXISTS "Authenticated users can manage team_members" ON public.team_members;

CREATE POLICY "Authenticated can view team_members"
ON public.team_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can update team_members"
ON public.team_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Owners can insert team_members"
ON public.team_members FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners can delete team_members"
ON public.team_members FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role));